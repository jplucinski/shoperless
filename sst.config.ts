/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "liteshop",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
      providers: { aws: { region: "eu-central-1" } },
    };
  },
  async run() {
    const koszykSharedKey = new sst.Secret("KoszykSharedKey");
    const adminPassword = new sst.Secret("AdminPassword");
    const furgonetkaClientId = new sst.Secret("FurgonetkaClientId");
    const furgonetkaClientSecret = new sst.Secret("FurgonetkaClientSecret");
    const tokenEncryptionKey = new sst.Secret("TokenEncryptionKey");

    const table = new sst.aws.Dynamo("Table", {
      fields: {
        pk: "string",
        sk: "string",
        gsi1pk: "string",
        gsi1sk: "string",
      },
      primaryIndex: { hashKey: "pk", rangeKey: "sk" },
      globalIndexes: {
        gsi1: { hashKey: "gsi1pk", rangeKey: "gsi1sk" },
      },
    });

    const images = new sst.aws.Bucket("Images", {
      access: "public",
    });

    const koszykCheckoutUuid = new sst.Secret("KoszykCheckoutUuid");

    const web = new sst.aws.Astro("Web", {
      path: "apps/web",
      environment: {
        KOSZYK_ENV: $app.stage === "production" ? "prod" : "sandbox",
      },
      link: [
        table,
        images,
        koszykSharedKey,
        koszykCheckoutUuid,
        adminPassword,
        furgonetkaClientId,
        furgonetkaClientSecret,
        tokenEncryptionKey,
      ],
    });

    new sst.aws.Cron("ReservationExpiry", {
      schedule: "rate(5 minutes)",
      job: {
        handler: "apps/web/src/jobs/release-expired-reservations.handler",
        link: [table, koszykSharedKey, adminPassword],
        nodejs: {
          install: ["@aws-sdk/client-dynamodb", "@aws-sdk/lib-dynamodb"],
        },
      },
    });

    return {
      url: web.url,
    };
  },
});
