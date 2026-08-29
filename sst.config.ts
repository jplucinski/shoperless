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

    const web = new sst.aws.Astro("Web", {
      path: "apps/web",
      link: [table, images, koszykSharedKey],
    });

    new sst.aws.Cron("ReservationExpiry", {
      schedule: "rate(5 minutes)",
      job: {
        handler: "apps/web/src/jobs/release-expired-reservations.handler",
        link: [table],
      },
    });

    return {
      url: web.url,
    };
  },
});
