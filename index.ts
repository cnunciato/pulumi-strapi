import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as random from "@pulumi/random";

type StrapiDBType = "mysql" | "postgres";

const config = new pulumi.Config();
const dbName = config.get("dbName") || "strapi";
const dbUsername = config.get("dbUsername") || "strapi";
const dbType: StrapiDBType = config.get("dbType") || "postgres";
const dbInstanceClass = config.get("dbInstanceClass") || "db.t3.micro";
const dbStorage = config.getNumber("dbStorage") || 20;
const dbPort = dbType === "mysql" ? 3306 : 5432;
const appPort = config.getNumber("appPort") || 1337;
const appCPU = config.getNumber("appCPU") || 2048;
const appMemory = config.getNumber("appMemory") || 4096;
const appUploadsPath = config.getNumber("appUploadsPath") || "public/uploads";
const subdomain = config.get("subdomain");
const domain = config.get("domain");
const tags: pulumi.Input<{ [key: string]: pulumi.Input<string> }> | undefined = config.getObject("tags");

const dbPassword = config.getSecret("dbPassword") || new random.RandomPassword("db", {
    length: 16,
    special: false,
}).result;

const vpc = new awsx.ec2.Vpc("vpc", {
    enableDnsHostnames: true,
    enableDnsSupport: true,
    tags,
});

const repo = new awsx.ecr.Repository("repository", {
    forceDelete: true,
    tags,
});

const image = new awsx.ecr.Image("service", {
    repositoryUrl: repo.url,
    path: "./app",
});

const lbSecurityGroup = new aws.ec2.SecurityGroup("alb", {
    vpcId: vpc.vpcId,
    ingress: [
        {
            fromPort: 80,
            toPort: 80,
            protocol: "tcp",
            cidrBlocks: [
                "0.0.0.0/0",
            ],
        },
        {
            fromPort: 443,
            toPort: 443,
            protocol: "tcp",
            cidrBlocks: [
                "0.0.0.0/0",
            ],
        },
    ],
    egress: [
        {
            fromPort: 0,
            toPort: 0,
            protocol: "-1",
            cidrBlocks: [
                "0.0.0.0/0"
            ],
        },
    ],
    tags,
});

const ecsSecurityGroup = new aws.ec2.SecurityGroup("cluster", {
    vpcId: vpc.vpcId,
    ingress: [
        {
            fromPort: appPort,
            toPort: appPort,
            protocol: "tcp",
            cidrBlocks: [
                "0.0.0.0/0",
            ],
        },
    ],
    egress: [
        {
            fromPort: 0,
            toPort: 0,
            protocol: "-1",
            cidrBlocks: [
                "0.0.0.0/0"
            ],
        },
    ],
    tags,
});

const dbSecurityGroup = new aws.ec2.SecurityGroup("db", {
    vpcId: vpc.vpcId,
    ingress: [
        {
            fromPort: dbPort,
            toPort: dbPort,
            protocol: "tcp",
            cidrBlocks: [
                "0.0.0.0/0",
            ],
        },
    ],
    egress: [
        {
            fromPort: 0,
            toPort: 0,
            protocol: "-1",
            cidrBlocks: [
                "0.0.0.0/0"
            ],
        },
    ],
    tags,
});

const efsSecurityGroup = new aws.ec2.SecurityGroup("fs", {
    vpcId: vpc.vpcId,
    ingress: [
        {
            fromPort: 2049,
            toPort: 2049,
            protocol: "tcp",
            cidrBlocks: [
                "0.0.0.0/0",
            ],
        },
    ],
    egress: [
        {
            fromPort: 0,
            toPort: 0,
            protocol: "-1",
            cidrBlocks: [
                "0.0.0.0/0"
            ],
        },
    ],
    tags,
});

const dbSubnetGroup = new aws.rds.SubnetGroup("db", {
    subnetIds: vpc.privateSubnetIds,
    tags,
});

const db = new aws.rds.Instance("db", {
    engine: dbType,
    instanceClass: dbInstanceClass,
    allocatedStorage: dbStorage,
    username: dbUsername,
    password: dbPassword,
    dbName: dbName,
    dbSubnetGroupName: dbSubnetGroup.name,
    skipFinalSnapshot: true,
    vpcSecurityGroupIds: [
        dbSecurityGroup.id,
    ],
    tags,
});

const alb = new awsx.lb.ApplicationLoadBalancer("alb", {
    defaultTargetGroup: {
        port: appPort,
        vpcId: vpc.vpcId,
        targetType: "ip",
        healthCheck: {
            path: "/",
            matcher: "200-399",
        },
    },
    subnetIds: vpc.publicSubnetIds,
    securityGroups: [
        lbSecurityGroup.id,
    ],
    tags,
});

const fileSystem = new aws.efs.FileSystem("fs", {
    tags,
});

const mountTarget1 = new aws.efs.MountTarget("fs-1", {
    fileSystemId: fileSystem.id,
    subnetId: vpc.publicSubnetIds.apply(ids => ids[0]),
    securityGroups: [
        efsSecurityGroup.id,
    ],
});

const mountTarget2 = new aws.efs.MountTarget("fs-2", {
    fileSystemId: fileSystem.id,
    subnetId: vpc.publicSubnetIds.apply(ids => ids[1]),
    securityGroups: [
        efsSecurityGroup.id,
    ],
});

const cluster = new aws.ecs.Cluster("cluster", {
    tags,
});

const service = new awsx.ecs.FargateService("service", {
    continueBeforeSteadyState: true,
    cluster: cluster.arn,
    networkConfiguration: {
        assignPublicIp: true,
        subnets: vpc.publicSubnetIds,
        securityGroups: [
            ecsSecurityGroup.id,
        ],
    },
    taskDefinitionArgs: {
        container: {
            image: image.imageUri,
            cpu: appCPU,
            memory: appMemory,
            portMappings: [
                {
                    targetGroup: alb.defaultTargetGroup,
                },
            ],
            mountPoints: [
                {
                    containerPath: `/opt/app/${appUploadsPath}`,
                    sourceVolume: "service-volume",
                }
            ],
            environment: [
                {
                    name: "DATABASE_CLIENT",
                    value: dbType,
                },
                {
                    name: "DATABASE_HOST",
                    value: db.address,
                },
                {
                    name: "DATABASE_PORT",
                    value: db.port.apply(port => port.toString()),
                },
                {
                    name: "DATABASE_NAME",
                    value: db.dbName,
                },
                {
                    name: "DATABASE_USERNAME",
                    value: db.username,
                },
                {
                    name: "DATABASE_PASSWORD",
                    value: db.password.apply(password => password!),
                },
                {
                    name: "DOCKER_DEFAULT_PLATFORM",
                    value: "linux/amd64",
                },
            ],
        },
        volumes: [
            {
                name: "service-volume",
                efsVolumeConfiguration: {
                    fileSystemId: mountTarget1.fileSystemId,
                    transitEncryption: "ENABLED",
                },
            },
        ],
    },
    tags,
});

if (domain && subdomain) {
    const fqdn = [ subdomain, domain ].join(".");
    const zone = aws.route53.getZoneOutput({ name: domain });

    const certificate = new aws.acm.Certificate("certificate", {
        domainName: fqdn,
        validationMethod: "DNS",
        tags,
    });

    const validationOption = certificate.domainValidationOptions.apply(options => options[0]);
    const validationRecord = new aws.route53.Record("certificate", {
        name: validationOption.resourceRecordName,
        type: validationOption.resourceRecordType,
        zoneId: zone.zoneId,
        records: [
            validationOption.resourceRecordValue,
        ],
        ttl: 300,
    });

    const validation = new aws.acm.CertificateValidation("certificate", {
        certificateArn: certificate.arn,
        validationRecordFqdns: [
            validationRecord.fqdn,
        ],
    });

    const record = new aws.route53.Record("alb", {
        type: "A",
        zoneId: zone.zoneId,
        name: fqdn,
        aliases: [
            {
                name: alb.loadBalancer.dnsName,
                zoneId: alb.loadBalancer.zoneId,
                evaluateTargetHealth: true,
            },
        ],
    }, { dependsOn: certificate });

    const httpsListener = new aws.alb.Listener("alb", {
        port: 443,
        protocol: "HTTPS",
        loadBalancerArn: alb.loadBalancer.arn,
        certificateArn: certificate.arn,
        defaultActions: [
            {
                targetGroupArn: alb.defaultTargetGroup.arn,
                type: "forward",
            },
        ],
        tags,
    }, { dependsOn: [ validation, record ] });
}

export const url = domain && subdomain
    ? pulumi.interpolate`https://${subdomain}.${domain}`
    : pulumi.interpolate`http://${alb.loadBalancer.dnsName}`;
