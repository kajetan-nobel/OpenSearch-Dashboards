/*
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 * Any modifications Copyright OpenSearch Contributors. See
 * GitHub history for details.
 */

/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { CoreService } from '../../types';
import { IReadOnlyService, InternalSecurityServiceSetup } from './types';
import { CoreContext } from '../core_context';
import { Logger } from '../logging';

export class SecurityService implements CoreService<InternalSecurityServiceSetup> {
  private logger: Logger;
  private readonlyService?: IReadOnlyService;

  constructor(coreContext: CoreContext) {
    this.logger = coreContext.logger.get('security-service');
  }

  public setup() {
    this.logger.debug('Setting up Security service');

    const securityService = this;

    return {
      registerReadonlyService(service: IReadOnlyService) {
        securityService.readonlyService = service;
      },
      readonlyService() {
        return securityService.readonlyService!;
      },
    };
  }

  public start() {
    this.logger.debug('Starting plugin');
  }

  public stop() {
    this.logger.debug('Stopping plugin');
  }
}
