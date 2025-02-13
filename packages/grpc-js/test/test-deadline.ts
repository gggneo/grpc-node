/*
 * Copyright 2021 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import * as assert from 'assert';

import * as grpc from '../src';
import { experimental } from '../src';
import { ServerCredentials } from '../src';
import { ServiceClient, ServiceClientConstructor } from '../src/make-client';
import { loadProtoFile } from './common';
import ServiceConfig = experimental.ServiceConfig;

const clientInsecureCreds = grpc.credentials.createInsecure();
const serverInsecureCreds = ServerCredentials.createInsecure();

const TIMEOUT_SERVICE_CONFIG: ServiceConfig = {
  loadBalancingConfig: [],
  methodConfig: [
    {
      name: [{ service: 'TestService' }],
      timeout: {
        seconds: 1,
        nanos: 0,
      },
    },
  ],
};

describe('Client with configured timeout', () => {
  let server: grpc.Server;
  let Client: ServiceClientConstructor;
  let client: ServiceClient;

  before(done => {
    Client = loadProtoFile(__dirname + '/fixtures/test_service.proto')
      .TestService as ServiceClientConstructor;
    server = new grpc.Server();
    server.addService(Client.service, {
      unary: () => {},
      clientStream: () => {},
      serverStream: () => {},
      bidiStream: () => {},
    });
    server.bindAsync(
      'localhost:0',
      grpc.ServerCredentials.createInsecure(),
      (error, port) => {
        if (error) {
          done(error);
          return;
        }
        server.start();
        client = new Client(
          `localhost:${port}`,
          grpc.credentials.createInsecure(),
          { 'grpc.service_config': JSON.stringify(TIMEOUT_SERVICE_CONFIG) }
        );
        done();
      }
    );
  });

  after(done => {
    client.close();
    server.tryShutdown(done);
  });

  it('Should end calls without explicit deadline with DEADLINE_EXCEEDED', done => {
    client.unary({}, (error: grpc.ServiceError, value: unknown) => {
      assert(error);
      assert.strictEqual(error.code, grpc.status.DEADLINE_EXCEEDED);
      done();
    });
  });

  it('Should end calls with a long explicit deadline with DEADLINE_EXCEEDED', done => {
    const deadline = new Date();
    deadline.setSeconds(deadline.getSeconds() + 20);
    client.unary({}, (error: grpc.ServiceError, value: unknown) => {
      assert(error);
      assert.strictEqual(error.code, grpc.status.DEADLINE_EXCEEDED);
      done();
    });
  });
});
