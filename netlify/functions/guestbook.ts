import { Handler } from "@netlify/functions";
import { Entity, Service } from "electrodb";
import moment from "moment";
import {DynamoDB} from "aws-sdk";

const getEnv = (env: string, fallback: string = "") => {
  const value = process.env[env];
  if (value) {
      return value
  } else if (fallback) {
    return fallback;
  }
  console.log(`Missing Environment Variable, ${env}`);
}

const table = getEnv("DYNAMODB_TABLE", "tinkertamper");
const client = new DynamoDB.DocumentClient({
  region: "us-east-1",

  credentials: {
      accessKeyId: getEnv("DYNAMODB_ACCESS_KEY") as string,
      secretAccessKey: getEnv("DYNAMODB_SECRET") as string
  }
});

function toNearest(num: number, nearest: number) {
  return Math.round(num / nearest) * nearest;
}

function getDateInterval() {
  const date = moment.utc();
  const minute = toNearest(date.minute(), 20);
  date.set("minute", minute);
  return date.format("YYYY-MM-DD hh:mm");
}

const guestbook = new Entity({
  model: {
    entity: "guestbook",
    service: "wedding",
    version: "1"
  },
  attributes: {
    record: {
      type: ["guestbook"] as const,
    },
    name: {
      type: "string"
    },
    message: {
      type: "string"
    },
    email: {
      type: "string",
      hidden: true,
      validate: /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/i
    },
    createdAt: {
      type: "string",
      hidden: true,
      readOnly: true,
      default: () => moment.utc().format("YYYY-MM-DD hh:mm:ss"),
    },
    date: {
      type: "string",
      readOnly: true,
      default: () => {
        return Date().toString().split(' ').splice(0, 5).join(' ');
      }
    }
  },
  indexes: {
    records: {
      collection: "vistors",
      pk: {
        field: "pk",
        composite: ["record"]
      },
      sk: {
        field: "sk",
        composite: ["createdAt"]
      }
    }
  }
}, {table, client});

const ratelimitter = new Entity({
  model: {
    entity: "ratelimitter",
    service: "wedding",
    version: "1"
  }, 
  attributes: {
    record: {
      type: ["guestbook"] as const
    },
    interval: {
      type: "string",
      default: getDateInterval,
      set: getDateInterval,
    },
    count: {
      type: "number"
    }
  },
  indexes: {
    limits: {
      collection: "vistors",
      pk: {
        field: "pk",
        composite: ["record"]
      },
      sk: {
        field: "sk",
        composite: ["interval"]
      }
    }
  }
}, {table, client});

export const wedding = new Service({ratelimitter, guestbook});

type GuestbookEntry = {name: string, email: string, message: string};
type GuestbookDisplay = {name: string, date: string, message: string};

export async function getGuestbookRecords(): Promise<GuestbookDisplay[]> {
  return guestbook.query.records({record: "guestbook"}).go();
}

export function incrementRateLimit() {
  return ratelimitter.update({
      interval: getDateInterval(), 
      record: "guestbook"
    })
    .add({count: 1})
    .where(({count}, op) => `
      ${op.lte(count, 10)} or ${op.notExists(count)}
    `)
}

export function createGuestbookEntry(options: GuestbookEntry) {
  return guestbook.create({
    record: "guestbook",
    name: options.name,
    email: options.email,
    message: options.message,
  });
}

export async function signGuestbook(options: GuestbookEntry) {
  return client.transactWrite({
    TransactItems: [
      {
        Put: createGuestbookEntry({
          name: options.name,
          email: options.email,
          message: options.message,
        }).params()
      },
      {
        Update: incrementRateLimit().params()
      }
    ]
  }).promise();
}

function getPayload(body: string): GuestbookEntry {
  const payload = JSON.parse(body);
  return {
    name: payload.name,
    message: payload.message,
    email: payload.email,
  }
}

function formatResponse<T>(options?: {data?: T, message?: string, statusCode?: number}) {
  return {
    statusCode: options?.statusCode ?? 200,
    body: JSON.stringify({
      data: options?.data,
      message: options?.message ?? "thank you",
    })
  }
}

function getHandler() {
  return getGuestbookRecords();
}

function postHandler(body: string | null) {
  if (body === null) {
    return formatResponse({statusCode: 400});
  }
  const payload = getPayload(body);
  return signGuestbook(payload);
}

const handler: Handler = async (event, context) => {
  try {
    console.log({event});
    switch(event.httpMethod.toLowerCase()) {
      case 'get':
        return formatResponse({
          data: await getHandler()
        });
      case 'post':
        return formatResponse({
          data: await postHandler(event.body)
        });
      default: 
        return formatResponse({statusCode: 404});
    }
  } catch(err) {
    console.log({err});
    return formatResponse();
  }
};

export { handler };