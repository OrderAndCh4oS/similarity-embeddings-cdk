import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import {Construct} from 'constructs';
import * as path from "path";
import {Duration} from "aws-cdk-lib";

export class SimilarityEmbeddingsCdkStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const bucket = new s3.Bucket(this, 'SimilarityEmbeddingsBucket', {
            bucketName: 'similarity-embeddings',
        });

        const vpc = new ec2.Vpc(this, 'VPC', {
            maxAzs: 2
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

        const createEmbeddingHandler = new lambda.DockerImageFunction(this, 'CreateEmbeddingLambdaSimilarityEmbedding', {
            code: lambda.DockerImageCode.fromImageAsset(
                path.join(__dirname, '../lambdas'),
                {
                    cmd: ["create_embedding.index.handler"]
                }
            ),
            memorySize: 2048,
            timeout: Duration.minutes(15),
            architecture: lambda.Architecture.ARM_64,
            securityGroups: [lambdaSecurityGroup],
            filesystem: lambda.FileSystem.fromEfsAccessPoint(accessPoint, '/mnt/filesystem'),
            vpc,
        });

        bucket.grantRead(createEmbeddingHandler);
    }
}
