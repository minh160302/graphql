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

import { gql } from "apollo-server";
import type { DocumentNode } from "graphql";
import { Neo4jGraphQL } from "../../../src";
import { formatCypher, translateQuery, formatParams } from "../utils/tck-test-utils";
import { createJwtRequest } from "../../utils/create-jwt-request";

describe("Connections Alias", () => {
    let typeDefs: DocumentNode;
    let neoSchema: Neo4jGraphQL;

    beforeAll(() => {
        typeDefs = gql`
            type Movie {
                title: String!
                actors: [Actor!]! @relationship(type: "ACTED_IN", properties: "ActedIn", direction: IN)
            }

            type Actor {
                name: String!
                movies: [Movie!]! @relationship(type: "ACTED_IN", properties: "ActedIn", direction: OUT)
            }

            interface ActedIn {
                screenTime: Int!
            }
        `;

        neoSchema = new Neo4jGraphQL({
            typeDefs,
            config: { enableRegex: true },
        });
    });

    test("Alias Top Level Connection Field", async () => {
        const query = gql`
            {
                movies {
                    actors: actorsConnection {
                        totalCount
                    }
                }
            }
        `;

        const req = createJwtRequest("secret", {});
        const result = await translateQuery(neoSchema, query, {
            req,
        });

        expect(formatCypher(result.cypher)).toMatchInlineSnapshot(`
            "MATCH (this:\`Movie\`)
            CALL {
                WITH this
                MATCH (this)<-[this_connection_actorsthis0:ACTED_IN]-(this_Actor:\`Actor\`)
                WITH collect({ node: { __resolveType: \\"Actor\\" } }) AS edges
                WITH edges, size(edges) AS totalCount
                RETURN { edges: edges, totalCount: totalCount } AS actors
            }
            RETURN this { actors: actors } as this"
        `);

        expect(formatParams(result.params)).toMatchInlineSnapshot(`"{}"`);
    });

    test("Alias Top Level Connection Field Multiple Times", async () => {
        const query = gql`
            query {
                movies(where: { title: "Forrest Gump" }) {
                    title
                    hanks: actorsConnection(where: { node: { name: "Tom Hanks" } }) {
                        edges {
                            screenTime
                            node {
                                name
                            }
                        }
                    }
                    jenny: actorsConnection(where: { node: { name: "Robin Wright" } }) {
                        edges {
                            screenTime
                            node {
                                name
                            }
                        }
                    }
                }
            }
        `;

        const req = createJwtRequest("secret", {});
        const result = await translateQuery(neoSchema, query, {
            req,
        });

        expect(formatCypher(result.cypher)).toMatchInlineSnapshot(`
            "MATCH (this:\`Movie\`)
            WHERE this.title = $param0
            CALL {
                WITH this
                MATCH (this)<-[this_connection_hanksthis0:ACTED_IN]-(this_Actor:\`Actor\`)
                WHERE this_Actor.name = $this_connection_hanksparam0
                WITH collect({ screenTime: this_connection_hanksthis0.screenTime, node: { name: this_Actor.name } }) AS edges
                WITH edges, size(edges) AS totalCount
                RETURN { edges: edges, totalCount: totalCount } AS hanks
            }
            CALL {
                WITH this
                MATCH (this)<-[this_connection_jennythis0:ACTED_IN]-(this_Actor:\`Actor\`)
                WHERE this_Actor.name = $this_connection_jennyparam0
                WITH collect({ screenTime: this_connection_jennythis0.screenTime, node: { name: this_Actor.name } }) AS edges
                WITH edges, size(edges) AS totalCount
                RETURN { edges: edges, totalCount: totalCount } AS jenny
            }
            RETURN this { .title, hanks: hanks, jenny: jenny } as this"
        `);

        expect(formatParams(result.params)).toMatchInlineSnapshot(`
            "{
                \\"param0\\": \\"Forrest Gump\\",
                \\"this_connection_hanksparam0\\": \\"Tom Hanks\\",
                \\"this_connection_jennyparam0\\": \\"Robin Wright\\"
            }"
        `);
    });
});
