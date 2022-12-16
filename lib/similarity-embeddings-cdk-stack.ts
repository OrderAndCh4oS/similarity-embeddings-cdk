import * as cdk from 'aws-cdk-lib';
import {Duration} from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import {Construct} from 'constructs';
import * as path from "path";
import {readFileSync} from "fs";

export class SimilarityEmbeddingsCdkStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const vpc = new ec2.Vpc(this, 'VPC', {
            availabilityZones: ['eu-west-1b']
        });

        const security_group = new ec2.SecurityGroup(this, 'SimilarityEmbeddingsEc2SecurityGroup', {vpc});
        security_group.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22));

        const ec2MountInstance = new ec2.Instance(this, 'SimilarityEmbeddingsEc2Instance', {
            instanceType: ec2.InstanceType.of(ec2.InstanceClass.ARM1, ec2.InstanceSize.MEDIUM),
            machineImage: ec2.MachineImage.latestAmazonLinux({
                cpuType: ec2.AmazonLinuxCpuType.ARM_64,
                generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2
            }),
            availabilityZone: 'eu-west-1b',
            vpc,
            securityGroup: security_group,
            vpcSubnets: {subnetType: ec2.SubnetType.PUBLIC},
            keyName: 'similarity-embedding-ec2'
        });

        ec2MountInstance.addUserData(readFileSync(path.join(__dirname, '../scripts/ec2-init.sh'), 'utf8'));

        const efsSecurityGroup = new ec2.SecurityGroup(this, 'SimilarityEfsEmbeddingSecurityGroup', {
            vpc
        });

        const fs = new efs.FileSystem(this, 'EfsSimilarityEmbedding', {
            vpc: vpc,
            performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
            throughputMode: efs.ThroughputMode.ELASTIC,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            securityGroup: efsSecurityGroup,
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

        const lambdaConfig = {
            code: lambda.Code.fromAsset(path.join(__dirname, '../lambdas')),
            runtime: lambda.Runtime.PYTHON_3_9,
            memorySize: 8192,
            timeout: Duration.minutes(1),
            architecture: lambda.Architecture.ARM_64,
            securityGroups: [lambdaSecurityGroup],
            filesystem: lambda.FileSystem.fromEfsAccessPoint(accessPoint, '/mnt/filesystem'),
            vpc
        }

        const createMsMarcoDistilBertCosV5EmbeddingHandler = new lambda.Function(this, 'CreateMsMarcoDistilBertCosV5EmbeddingLambda', {
            handler: "create-embedding.handler",
            environment: {MODEL_NAME: 'msmarco-distilbert-cos-v5-model'},
            ...lambdaConfig
        });

        const createAllMpNetBaseV2EmbeddingHandler = new lambda.Function(this, 'CreateAllMpNetBaseV2EmbeddingLambda', {
            handler: "create-embedding.handler",
            environment: {MODEL_NAME: 'all-mpnet-base-v2'},
            ...lambdaConfig
        });

        const createMultiQaDistilBertCosV1EmbeddingHandler = new lambda.Function(this, 'CreateMultiQaDistilBertCosV1EmbeddingLambda', {
            handler: "create-embedding.handler",
            environment: {MODEL_NAME: 'multi-qa-distilbert-cos-v1'},
            ...lambdaConfig
        });

        const createMultiQaMiniLmL6CosV1EmbeddingHandler = new lambda.Function(this, 'CreateMultiQaMiniLmL6CosV1EmbeddingLambda', {
            handler: "create-embedding.handler",
            environment: {MODEL_NAME: 'multi-qa-MiniLM-L6-cos-v1'},
            ...lambdaConfig
        });

        const createMultiQaMpNetBaseCosV1EmbeddingHandler = new lambda.Function(this, 'CreateMultiQaMpNetBaseCosV1EmbeddingLambda', {
            handler: "create-embedding.handler",
            environment: {MODEL_NAME: 'multi-qa-mpnet-base-cos-v1'},
            ...lambdaConfig
        });

        const createMultiQaMpNetBaseDotV1EmbeddingHandler = new lambda.Function(this, 'CreateMultiQaMpNetBaseDotV1EmbeddingLambda', {
            handler: "create-embedding.handler",
            environment: {MODEL_NAME: 'multi-qa-mpnet-base-dot-v1'},
            ...lambdaConfig
        });

        const createAllMiniLmL6EmbeddingHandler = new lambda.Function(this, 'CreateAllMiniLmL6EmbeddingLambda', {
            handler: "create-embedding.handler",
            environment: {MODEL_NAME: 'all-MiniLM-L6-v2'},
            ...lambdaConfig
        });

        const api = new apigateway.RestApi(this, 'SimilarityEmbeddingApi', {
            defaultCorsPreflightOptions: {
                allowHeaders: apigateway.Cors.DEFAULT_HEADERS,
                allowMethods: apigateway.Cors.ALL_METHODS,
                allowOrigins: apigateway.Cors.ALL_ORIGINS
            },
        });
        const makeMethod = (model: string, handler: lambda.Function) => {
            api.root.addResource(model)
                .addMethod('post', new apigateway.LambdaIntegration(handler));
        }

        makeMethod('multi-qa-mpnet-base-dot-v1', createMultiQaMpNetBaseDotV1EmbeddingHandler);
        makeMethod('multi-qa-mpnet-base-cos-v1', createMultiQaMpNetBaseCosV1EmbeddingHandler);
        makeMethod('multi-qa-MiniLM-L6-cos-v1', createMultiQaMiniLmL6CosV1EmbeddingHandler);
        makeMethod('multi-qa-distilbert-cos-v1', createMultiQaDistilBertCosV1EmbeddingHandler);
        makeMethod('all-mpnet-base-v2', createAllMpNetBaseV2EmbeddingHandler);
        makeMethod('msmarco-distilbert-cos-v5-model', createMsMarcoDistilBertCosV5EmbeddingHandler);
        makeMethod('all-MiniLM-L6-v2', createAllMiniLmL6EmbeddingHandler);
    }
}
