# pulumi-strapi

An example that deploys [Strapi CMS](https://strapi.io/) as a containerized web app on AWS with [Pulumi](https://www.pulumi.com/).

* Deploys in a [VPC](https://aws.amazon.com/vpc/) (with public and private subnets) with [ECS Fargate](https://aws.amazon.com/fargate/) and [Elastic Load Balancing](https://aws.amazon.com/elasticloadbalancing/)
* Forwards logs to [CloudWatch](https://aws.amazon.com/cloudwatch/), streams CloudWatch logs to your terminal
* Supports both [RDS](https://aws.amazon.com/rds/) MySQL and PostgreSQL (with PostgreSQL as the default)
* Stores your media (e.g., Strapi uploads) with [Amazon EFS](https://aws.amazon.com/efs/)
* Supports custom domains and SSL certs with [Route 53](https://aws.amazon.com/route53/) and [ACM](https://aws.amazon.com/certificate-manager/)
* Deploy from your laptop, in CI (e.g., GitHub Actions), or with [Pulumi Deployments](https://www.pulumi.com/product/pulumi-deployments/)
* Everything written in TypeScript

More docs to come! 🚀

## Deploy your own

```bash
pulumi new https://github.com/cnunciato/pulumi-strapi
```

[![Deploy with Pulumi](https://get.pulumi.com/new/button.svg)](https://app.pulumi.com/new?template=https://github.com/cnunciato/pulumi-strapi)

## Handy local commands

```bash
# Install Strapi and Pulumi dependencies.
make ensure

# Develop locally -- build content types, etc. -- using the SQLite backend.
make serve

# Create a new Pulumi stack (e.g., `dev`).
make new-stack

# Deploy!
make deploy

# Browse to your newly deployed Strapi CMS.
make browse

# Stream CloudWatch logs to your terminal.
make logs

# When you're done, tear everything down.
make destroy
```

See the `Makefile` for details.

## Pulumi configuration settings

All configuration settings are optional.

| Key | Type | Example | Default |
| --- | ---- | ------- | ------- |
| `aws:region` | `string` | `us-west-2` | `us-west-2` |
| `dbName` | `string` | `strapi` | `strapi` |
| `dbUsername` | `string` | `strapi` | `strapi` |
| `dbType` | `string` | `mysql` | `mysql` |
| `dbInstanceClass` | `string` | `db.t3.micro` | `db.t3.micro` |
| `dbStorage` | `number` | `20` | `20` |
| `dbPassword` | `string` |`StrongPass1` | [`new random.RandomPassword()`](https://www.pulumi.com/registry/packages/random/api-docs/randompassword/) |
| `appPort` | `number` | `1337` | `1337` |
| `appCPU` | `number` | `2048` | `2048` |
| `appMemory` | `number` | `4096` | `4096` |
| `appUploadsPath`  | `string` | `public/uploads` | `public/uploads` |
| `subdomain` | `string` | `my-cms` | None |
| `domain` | `string` | `example.com` | None |
| `tags` | `object` | `{ owner: "yourname" }` | None |
