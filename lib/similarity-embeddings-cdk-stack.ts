import * as cdk from 'aws-cdk-lib';
import {Duration} from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import {AmazonLinuxCpuType, AmazonLinuxGeneration, InstanceClass, InstanceSize, SubnetType} from 'aws-cdk-lib/aws-ec2';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import {Code, Runtime} from 'aws-cdk-lib/aws-lambda';
import {Construct} from 'constructs';
import * as path from "path";
import {Cors, LambdaIntegration, RestApi} from "aws-cdk-lib/aws-apigateway";

export class SimilarityEmbeddingsCdkStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const vpc = new ec2.Vpc(this, 'VPC', {
            availabilityZones: ['eu-west-1b']
        });

        const security_group = new ec2.SecurityGroup(this, 'SimilarityEmbeddingsEc2SecurityGroup', { vpc });
        security_group.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22));

        const ec2MountInstance = new ec2.Instance(this, 'SimilarityEmbeddingsEc2Instance', {
            instanceType: ec2.InstanceType.of(InstanceClass.ARM1, InstanceSize.MEDIUM),
            machineImage: ec2.MachineImage.latestAmazonLinux({
                cpuType: AmazonLinuxCpuType.ARM_64,
                generation: AmazonLinuxGeneration.AMAZON_LINUX_2
            }),
            availabilityZone: 'eu-west-1b',
            vpc,
            securityGroup: security_group,
            vpcSubnets: {
                subnetType: SubnetType.PUBLIC
            },
            keyName: 'similarity-embedding-ec2'
        });

        const efsSecurityGroup = new ec2.SecurityGroup(this, 'SimilarityEfsEmbeddingSecurityGroup', {
            vpc
        });

        const fs = new efs.FileSystem(this, 'EfsSimilarityEmbedding', {
            vpc: vpc,
            performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
            throughputMode: efs.ThroughputMode.BURSTING,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            securityGroup: efsSecurityGroup
        });

        fs.connections.allowDefaultPortFrom(ec2MountInstance);

        const accessPoint = fs.addAccessPoint('SimilarityEmbeddingLambdaAccessPoint', {
            path: '/sentence_transformers',
            createAcl: {
                ownerGid: '1001',
                ownerUid: '1001',
                permissions: '755',
            },
            posixUser: {
                uid: '1001',
                gid: '1001',
            }
        });

        const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'SimilarityEmbeddingLambdaSecurityGroup', {
            vpc
        });

        const createEmbeddingHandler = new lambda.Function(this, 'CreateSimilarityEmbeddingLambda', {
            code: Code.fromAsset(path.join(__dirname, '../lambdas')),
            handler: "create_embedding.handler",
            runtime: Runtime.PYTHON_3_9,
            memorySize: 2048,
            timeout: Duration.minutes(1),
            architecture: lambda.Architecture.ARM_64,
            securityGroups: [lambdaSecurityGroup],
            filesystem: lambda.FileSystem.fromEfsAccessPoint(accessPoint, '/mnt/filesystem'),
            vpc
        });

        const api = new RestApi(this, 'AnnCache_Api', {
            defaultCorsPreflightOptions: {
                allowHeaders: Cors.DEFAULT_HEADERS,
                allowMethods: Cors.ALL_METHODS,
                allowOrigins: Cors.ALL_ORIGINS
            },
        });

        const createEmbeddingResource = api.root.addResource('create-embedding');
        createEmbeddingResource.addMethod('post', new LambdaIntegration(createEmbeddingHandler));
    }
}
