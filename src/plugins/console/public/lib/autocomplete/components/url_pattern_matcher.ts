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

import _ from 'lodash';
import {
  SharedComponent,
  ConstantComponent,
  AcceptEndpointComponent,
  ListComponent,
  SimpleParamComponent,
} from './index';

import { FullRequestComponent } from './full_request_component';
import { Endpoint, UrlComponent, UrlObjectComponent } from '../types';
import { ComponentFactory, ParametrizedComponentFactories } from '../../osd/osd';

interface MethodData {
  rootComponent: SharedComponent;
  parametrizedComponentFactories: ParametrizedComponentFactories | DefaultComponentFactories;
}

interface DefaultComponentFactories {
  getComponent: () => void;
}

/**
 * @param parametrizedComponentFactories a dict of the following structure
 * that will be used as a fall back for pattern parameters (i.e.: {indices})
 * {
 *   indices: function (part, parent) {
 *      return new SharedComponent(part, parent)
 *   }
 * }
 * @constructor
 */
export class UrlPatternMatcher {
  private methodsData: Record<string, MethodData>;
  // This is not really a component, just a handy container to make iteration logic simpler
  constructor(parametrizedComponentFactories?: ParametrizedComponentFactories) {
    // We'll group endpoints by the methods which are attached to them,
    // to avoid suggesting endpoints that are incompatible with the
    // method that the user has entered.
    this.methodsData = {};
    ['HEAD', 'GET', 'PUT', 'POST', 'DELETE'].forEach((method) => {
      this.methodsData[method] = {
        rootComponent: new SharedComponent('ROOT'),
        parametrizedComponentFactories: parametrizedComponentFactories || {
          getComponent: () => {},
        },
      };
    });
  }
  addEndpoint(pattern: string, endpoint: Endpoint) {
    endpoint.methods.forEach((method) => {
      let c: UrlComponent | ComponentFactory;
      let activeComponent = this.methodsData[method].rootComponent;
      if (endpoint.template) {
        new FullRequestComponent(pattern + '[body]', activeComponent, endpoint.template);
      }
      const endpointComponents = endpoint.url_components || {};
      const partList = pattern.split('/');
      _.each(partList, (part, partIndex) => {
        if (part.search(/^{.+}$/) >= 0) {
          part = part.substr(1, part.length - 2);
          if (activeComponent.getComponent(part)) {
            // we already have something for this, reuse
            activeComponent = activeComponent.getComponent(part) as SharedComponent;
            return;
          }
          // a new path, resolve.

          if ((c = endpointComponents[part])) {
            // endpoint specific. Support list
            if (Array.isArray(c)) {
              c = new ListComponent(part, c, activeComponent);
            } else if (_.isObject(c)) {
              const objComponent = c as UrlObjectComponent;
              if (objComponent.type === 'list') {
                c = new ListComponent(
                  part,
                  objComponent.list,
                  activeComponent,
                  objComponent.multiValued,
                  objComponent.allow_non_valid
                );
              }
            } else {
              // eslint-disable-next-line no-console
              console.warn('incorrectly configured url component ', part, ' in endpoint', endpoint);
              c = new SharedComponent(part);
            }
          } else if (this.methodsData[method].parametrizedComponentFactories.getComponent(part)) {
            // c is a f
            c = this.methodsData[method].parametrizedComponentFactories.getComponent(part)!;
            c = c(part, activeComponent);
          } else {
            // just accept whatever with not suggestions
            c = new SimpleParamComponent(part, activeComponent);
          }

          activeComponent = c as SharedComponent;
        } else {
          // not pattern
          let lookAhead = part;
          let s;

          for (partIndex++; partIndex < partList.length; partIndex++) {
            s = partList[partIndex];
            if (s.indexOf('{') >= 0) {
              break;
            }
            lookAhead += '/' + s;
          }

          if (activeComponent.getComponent(part)) {
            // we already have something for this, reuse
            activeComponent = activeComponent.getComponent(part)!;
            (activeComponent as ConstantComponent).addOption(lookAhead);
          } else {
            c = new ConstantComponent(part, activeComponent, lookAhead);
            activeComponent = c;
          }
        }
      });
      // mark end of endpoint path
      new AcceptEndpointComponent(endpoint, activeComponent);
    });
  }

  getTopLevelComponents = (method: string) => {
    const methodRoot = this.methodsData[method];
    if (!methodRoot) {
      return [];
    }
    return methodRoot.rootComponent.next;
  };
}
