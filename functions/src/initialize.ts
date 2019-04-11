import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import request from 'request-promise-native';
import * as jsoncParser from 'jsonc-parser';
import * as url from 'url';
import cors from 'cors';
import { initAdmin, QR_RTDB_PATH } from './util';

initAdmin();

const handler =
  process.env.BUILD === 'dev' || process.env.NOT_MODS
    ? functions
    : functions.handler;

const initialize = handler.https.onRequest((req, res) => {
  // Automatically allow cross-origin requests.
  return cors({ origin: true })(req, res, async () => {
    // Only allow GET requests.
    if (req.method !== 'GET') {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Invalid method, only GET requests are allowed.'
      );
    }

    const currentRules = await getRules();
    const segments = QR_RTDB_PATH.replace(/^\s+|\s+$/g, '')
      .replace(/^\/+|\/+$/g, '')
      .split('/');

    // Only add the necessary rules if they're not present already.
    if (!checkRulesAlreadyApplied(currentRules, segments)) {
      // The rules we're going to insert
      const insertRules = {
        '.read': false,
        '.write': false,
        $QRtoken: {
          ct: {
            '.read': true
          }
        }
      };

      // Detect the necessary edits to insert the rules without making any
      // changes to the existing rules (this maintains comments & indenting).
      const edits = jsoncParser.modify(
        currentRules,
        ['rules', ...segments],
        insertRules,
        {
          formattingOptions: {
            insertSpaces: true,
            tabSize: 2
          }
        }
      );

      // Apply the edits
      const modifiedRules = jsoncParser.applyEdits(currentRules, edits);

      // Save the modified rules to the Firebase servers.
      await setRules(modifiedRules);
    }

    // Done!
    res.send('ok');
  });
});

/**
 * Get the URL for the rules REST API.
 */
function getRulesUrl() {
  const dbUrl = url.parse(getDatabaseUrl());
  return `https://${dbUrl.host}/.settings/rules.json`;
}

function getDatabaseUrl(): string {
  const options = admin.app().options;
  let databaseURL = options.databaseURL;

  if (databaseURL) {
    return databaseURL;
  }

  return 'https://' + options.projectId + '.firebaseio.com';
}

/**
 * Get the necessary auth token for the project.
 */
async function getToken(): Promise<string> {
  const tokenObj = await (admin.app() as any).INTERNAL.getToken();
  return tokenObj.accessToken;
}

async function getRules(): Promise<string> {
  return request({
    method: 'GET',
    uri: getRulesUrl(),
    headers: {
      Authorization: 'Bearer ' + (await getToken())
    }
  });
}

/**
 * Send RTDB rules to the Firebase servers.
 */
async function setRules(json: string): Promise<any> {
  return request({
    method: 'PUT',
    uri: getRulesUrl(),
    headers: {
      Authorization: 'Bearer ' + (await getToken())
    },
    body: json
  });
}

/**
 * Check whether the necessary rules have already been applied or not.
 */
function checkRulesAlreadyApplied(
  rulesJSON: string,
  segments: string[]
): boolean {
  let rules = jsoncParser.parse(rulesJSON);

  if (!('rules' in rules)) {
    return false;
  }

  let pointer = rules.rules;

  const hasPath = segments.every(segment => {
    if (!contains(pointer, segment)) {
      return false;
    }
    pointer = pointer[segment];
    return true;
  });

  if (!hasPath) {
    return false;
  }

  return (
    '.read' in pointer &&
    pointer['.read'] === false &&
    '.write' in pointer &&
    pointer['.write'] === false &&
    '$QRtoken' in pointer &&
    'ct' in pointer['$QRtoken'] &&
    '.read' in pointer['$QRtoken']['ct'] &&
    pointer['$QRtoken']['ct']['.read'] === true
  );
}

function contains(obj: { [k: string]: any }, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

exports = module.exports = initialize;
