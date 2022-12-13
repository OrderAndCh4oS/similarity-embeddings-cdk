import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import {ThroughputMode} from 'aws-cdk-lib/aws-efs';
import {Construct} from 'constructs';
import {Architecture} from "aws-cdk-lib/aws-lambda";
import {Duration, RemovalPolicy} from "aws-cdk-lib";
import * as path from "path";

export class SimilarityEmbeddingsCdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const vpc = new ec2.Vpc(this, 'VPC', {
      maxAzs: 2
    });

    const efsSecurityGroup = new ec2.SecurityGroup(this, 'EfsSimilarityEmbeddingSecurityGroup', {
      vpc
    });

    const fs = new efs.FileSystem(this, 'EfsSimilarityEmbeddingFileSystem', {
      vpc: vpc,
      performanceMode: efs.PerformanceMode.GENERAL_PURPOSE,
      throughputMode: ThroughputMode.BURSTING,
      removalPolicy: RemovalPolicy.DESTROY,
      securityGroup: efsSecurityGroup
    });

    const accessPoint = fs.addAccessPoint('LambdaAccessPoint', {
      path: '/export/lambda',
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

    const createEmbeddingHandler = new lambda.DockerImageFunction(this, 'CreateEmbeddingLambdaFunction', {
      code: lambda.DockerImageCode.fromImageAsset(
          path.join(__dirname, '../lambdas'),
          {
            cmd: ["create_embedding.index.handler"]
          }
      ),
      memorySize: 1024,
      timeout: Duration.seconds(10),
      architecture: Architecture.ARM_64,
      securityGroups: [lambdaSecurityGroup],
      filesystem: lambda.FileSystem.fromEfsAccessPoint(accessPoint, '/mnt/filesystem'),
      vpc,
      // Todo: could store to the redis cache on creation…
      // environment: {
      //   CACHE_HOST: redisCache.attrRedisEndpointAddress,
      //   CACHE_PORT: redisCache.attrRedisEndpointPort
      // },
    });
  }
}
