/*
 * Copyright (c) "Neo4j"
 * Neo4j Sweden AB [http://neo4j.com]
 *
 * This file is part of Neo4j.
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
 */

import Debug from "debug";
import type { Key, Neo4jAuthorizationSettings } from "../../types";

import { AUTHORIZATION_UNAUTHENTICATED, DEBUG_AUTH } from "../../constants";
import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";
import type { JWTPayload } from "jose";
import { parseBearerToken } from "./parse-request-token";
import { Neo4jGraphQLError } from "../Error";
import type { Neo4jGraphQLContext } from "../../types/neo4j-graphql-context";

const debug = Debug(DEBUG_AUTH);

export class Neo4jGraphQLAuthorization {
    private authorization: Neo4jAuthorizationSettings;

    constructor(authorization: Neo4jAuthorizationSettings) {
        this.authorization = authorization;
    }

    public get globalAuthentication(): boolean {
        return this.authorization.globalAuthentication || false;
    }

    public async decode(context: Neo4jGraphQLContext): Promise<JWTPayload | undefined> {
        const bearerToken = context.token;
        if (!bearerToken) {
            throw new Neo4jGraphQLError(AUTHORIZATION_UNAUTHENTICATED);
        }
        const token = parseBearerToken(bearerToken);
        if (!token) {
            throw new Neo4jGraphQLError(AUTHORIZATION_UNAUTHENTICATED);
        }
        try {
            if (this.authorization.verify === false) {
                debug("Skipping verifying JWT as verify is set to false");
                return decodeJwt(token);
            }
            const secret = this.resolveKey(context);
            return await this.verify(token, secret);
        } catch (error) {
            debug("%s", error);
            throw new Neo4jGraphQLError(AUTHORIZATION_UNAUTHENTICATED);
        }
    }

    public decodeBearerToken(bearerToken: string): JWTPayload | undefined {
        const token = parseBearerToken(bearerToken);
        if (!token) {
            throw new Neo4jGraphQLError(AUTHORIZATION_UNAUTHENTICATED);
        }
        try {
            return decodeJwt(token);
        } catch (error) {
            debug("%s", error);
            throw new Neo4jGraphQLError(AUTHORIZATION_UNAUTHENTICATED);
        }
    }

    public async decodeBearerTokenWithVerify(bearerToken: string | undefined): Promise<JWTPayload | undefined> {
        if (!bearerToken) {
            throw new Neo4jGraphQLError(AUTHORIZATION_UNAUTHENTICATED);
        }

        const token = parseBearerToken(bearerToken);
        if (!token) {
            throw new Neo4jGraphQLError(AUTHORIZATION_UNAUTHENTICATED);
        }
        try {
            if (this.authorization.verify === false) {
                debug("Skipping verifying JWT as verify is set to false");
                return decodeJwt(token);
            }
            return await this.verify(token, this.authorization.key as Key);
        } catch (error) {
            debug("%s", error);
            throw new Neo4jGraphQLError(AUTHORIZATION_UNAUTHENTICATED);
        }
    }

    private resolveKey(context: Neo4jGraphQLContext): Key {
        if (typeof this.authorization.key === "function") {
            return this.authorization.key(context);
        } else {
            return this.authorization.key;
        }
    }

    private async verify(token: string, secret: Key): Promise<JWTPayload> {
        if (typeof secret === "string") {
            debug("Verifying JWT using secret");
            const { payload } = await jwtVerify(token, Buffer.from(secret), this.authorization.verifyOptions);
            return payload;
        }
        debug("Verifying JWKS using url");
        const { url, options } = secret;
        const JWKS = createRemoteJWKSet(new URL(url), options);
        const { payload } = await jwtVerify(token, JWKS, this.authorization.verifyOptions);
        return payload;
    }
}
