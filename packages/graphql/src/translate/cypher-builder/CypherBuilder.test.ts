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

import { whereRegEx } from "../where/utils";
import * as CypherBuilder from "./CypherBuilder";

describe("CypherBuilder", () => {
    describe("Match", () => {
        test("Match node", () => {
            const idParam = new CypherBuilder.Param("my-id");
            const nameParam = new CypherBuilder.Param("my-name");
            const ageParam = new CypherBuilder.Param(5);

            const movieNode = new CypherBuilder.Node({
                labels: ["Movie"],
            });

            const matchQuery = new CypherBuilder.Match(movieNode, { test: new CypherBuilder.Param("test-value") })
                .where([movieNode, { id: idParam, name: nameParam, age: ageParam }])
                .return(movieNode);

            const queryResult = matchQuery.build();
            expect(queryResult.cypher).toMatchInlineSnapshot(`
                "MATCH (this0:\`Movie\` { test: $param0 })
                WHERE this0.id = $param1
                AND this0.name = $param2
                AND this0.age = $param3
                RETURN this0"
            `);

            expect(queryResult.params).toMatchInlineSnapshot(`
                Object {
                  "param0": "test-value",
                  "param1": "my-id",
                  "param2": "my-name",
                  "param3": 5,
                }
            `);
        });

        test("Match node with alias", () => {
            const idParam = new CypherBuilder.Param("my-id");
            const nameParam = new CypherBuilder.Param("my-name");

            const movieNode = new CypherBuilder.Node({
                labels: ["Movie"],
            });

            const matchQuery = new CypherBuilder.Match(movieNode, { test: new CypherBuilder.Param("test-value") })
                .where([movieNode, { id: idParam, name: nameParam }])
                .return(movieNode, ["name"], "myAlias");

            const queryResult = matchQuery.build();
            expect(queryResult.cypher).toMatchInlineSnapshot(`
                "MATCH (this0:\`Movie\` { test: $param0 })
                WHERE this0.id = $param1
                AND this0.name = $param2
                RETURN this0 {.name} AS myAlias"
            `);

            expect(queryResult.params).toMatchInlineSnapshot(`
                Object {
                  "param0": "test-value",
                  "param1": "my-id",
                  "param2": "my-name",
                }
            `);
        });

        test("Match node with and and or in where with top level properties", () => {
            const idParam = new CypherBuilder.Param("my-id");
            const nameParam = new CypherBuilder.Param("my-name");
            const ageParam = new CypherBuilder.Param(5);
            const descriptionParam = new CypherBuilder.Param("A description");

            const movieNode = new CypherBuilder.Node({
                labels: ["Movie"],
            });

            const matchQuery = new CypherBuilder.Match(movieNode)
                .where(
                    CypherBuilder.and(
                        [movieNode, { id: idParam }],
                        CypherBuilder.or([movieNode, { name: nameParam }], [movieNode, { age: ageParam }])
                    ),
                    [movieNode, { description: descriptionParam }]
                )
                .return(movieNode);

            const queryResult = matchQuery.build();
            expect(queryResult.cypher).toMatchInlineSnapshot(`
                "MATCH (this0:\`Movie\`)
                WHERE (this0.id = $param0
                AND (this0.name = $param1
                OR this0.age = $param2))
                AND this0.description = $param3
                RETURN this0"
            `);

            expect(queryResult.params).toMatchInlineSnapshot(`
                Object {
                  "param0": "my-id",
                  "param1": "my-name",
                  "param2": 5,
                  "param3": "A description",
                }
            `);
        });

        test("Match node with and and or in where", () => {
            const idParam = new CypherBuilder.Param("my-id");
            const nameParam = new CypherBuilder.Param("my-name");
            const ageParam = new CypherBuilder.Param(5);

            const movieNode = new CypherBuilder.Node({
                labels: ["Movie"],
            });

            const matchQuery = new CypherBuilder.Match(movieNode)
                .where(
                    CypherBuilder.and(
                        [movieNode, { id: idParam }],
                        CypherBuilder.or([movieNode, { name: nameParam }], [movieNode, { age: ageParam }])
                    )
                )
                .return(movieNode);

            const queryResult = matchQuery.build();
            expect(queryResult.cypher).toMatchInlineSnapshot(`
                "MATCH (this0:\`Movie\`)
                WHERE (this0.id = $param0
                AND (this0.name = $param1
                OR this0.age = $param2))
                RETURN this0"
            `);

            expect(queryResult.params).toMatchInlineSnapshot(`
                Object {
                  "param0": "my-id",
                  "param1": "my-name",
                  "param2": 5,
                }
            `);
        });

        test("Match node with single and operation in where", () => {
            const nameParam = new CypherBuilder.Param("my-name");

            const movieNode = new CypherBuilder.Node({
                labels: ["Movie"],
            });

            const matchQuery = new CypherBuilder.Match(movieNode)
                .where(CypherBuilder.and([movieNode, { name: nameParam }]))
                .return(movieNode);

            const queryResult = matchQuery.build();
            expect(queryResult.cypher).toMatchInlineSnapshot(`
                "MATCH (this0:\`Movie\`)
                WHERE this0.name = $param0
                RETURN this0"
            `);

            expect(queryResult.params).toMatchInlineSnapshot(`
                Object {
                  "param0": "my-name",
                }
            `);
        });

        describe("Where clauses", () => {
            test("Match node with IN", () => {
                const titleParam = new CypherBuilder.Param(["my-name"]);

                const movieNode = new CypherBuilder.Node({
                    labels: ["Movie"],
                });

                const matchQuery = new CypherBuilder.Match(movieNode)
                    .where([movieNode, { title: CypherBuilder.in(titleParam) }])
                    .return(movieNode);

                const queryResult = matchQuery.build();
                expect(queryResult.cypher).toMatchInlineSnapshot(`
                "MATCH (this:Movie)
                WHERE this.title IN $param0
                RETURN this { .title } as this"
            `);

                expect(queryResult.params).toMatchInlineSnapshot(`
                Object {
                  "param0": "my-name",
                }
            `);
            });
        });
    });

    describe("Create", () => {
        test("Create Node", () => {
            const idParam = new CypherBuilder.Param("my-id");
            const movieNode = new CypherBuilder.Node({
                labels: ["Movie"],
            });

            const createQuery = new CypherBuilder.Create(movieNode, {
                test: new CypherBuilder.Param("test-value"),
                id: idParam,
            })
                .set({ id: idParam })
                .return(movieNode);

            const queryResult = createQuery.build();
            expect(queryResult.cypher).toMatchInlineSnapshot(`
                "CREATE (this0:\`Movie\` { test: $param0, id: $param1 })
                SET this0.id = $param1
                RETURN this0"
                `);

            expect(queryResult.params).toMatchInlineSnapshot(`
                Object {
                  "param0": "test-value",
                  "param1": "my-id",
                }
            `);
        });
    });

    describe("Merge", () => {
        test("Merge node", () => {
            const node = new CypherBuilder.Node({
                labels: ["MyLabel"],
            });

            const query = new CypherBuilder.Merge(node).onCreate({ age: new CypherBuilder.Param(23) });

            const queryResult = query.build();
            expect(queryResult.cypher).toMatchInlineSnapshot(`
                "MERGE (this0:\`MyLabel\`)
                ON CREATE SET
                        this0.age = $param0
                "
            `);
            expect(queryResult.params).toMatchInlineSnapshot(`
                Object {
                  "param0": 23,
                }
            `);
        });

        test("Merge node with parameters", () => {
            const node = new CypherBuilder.Node({
                labels: ["MyLabel"],
            });

            const query = new CypherBuilder.Merge(node, { test: new CypherBuilder.Param("test") }).onCreate({
                age: new CypherBuilder.Param(23),
            });

            const queryResult = query.build();
            expect(queryResult.cypher).toMatchInlineSnapshot(`
                "MERGE (this0:\`MyLabel\` { test: $param0 })
                ON CREATE SET
                        this0.age = $param1
                "
            `);
            expect(queryResult.params).toMatchInlineSnapshot(`
                Object {
                  "param0": "test",
                  "param1": 23,
                }
            `);
        });

        test("Merge relationship", () => {
            const node1 = new CypherBuilder.Node({
                labels: ["MyLabel"],
            });
            const node2 = new CypherBuilder.Node({});

            const relationship = new CypherBuilder.Relationship({ source: node1, target: node2 });

            const query = new CypherBuilder.Merge(relationship).onCreate({
                source: {
                    age: new CypherBuilder.Param(23),
                    name: new CypherBuilder.Param("Keanu"),
                },
                relationship: {
                    screentime: new CypherBuilder.Param(10),
                },
            });

            const queryResult = query.build();
            expect(queryResult.cypher).toMatchInlineSnapshot(`
                "MERGE (this1)-[this0]->(this2)
                ON CREATE SET
                        this1.age = $param0,
                this1.name = $param1,
                this0.screentime = $param2
                "
            `);
            expect(queryResult.params).toMatchInlineSnapshot(`
                Object {
                  "param0": 23,
                  "param1": "Keanu",
                  "param2": 10,
                }
            `);
        });
    });

    describe("Call", () => {
        test("Wraps query inside Call", () => {
            const idParam = new CypherBuilder.Param("my-id");
            const movieNode = new CypherBuilder.Node({
                labels: ["Movie"],
            });

            const createQuery = new CypherBuilder.Create(movieNode).set({ id: idParam }).return(movieNode);

            const queryResult = new CypherBuilder.Call(createQuery).build();
            expect(queryResult.cypher).toMatchInlineSnapshot(`
                "CALL {
                	CREATE (this0:\`Movie\`)
                SET this0.id = $param0
                RETURN this0
                	RETURN COUNT(*) AS _
                }"
            `);
            expect(queryResult.params).toMatchInlineSnapshot(`
                Object {
                  "param0": "my-id",
                }
            `);
        });

        test("Nested Call", () => {
            const movieNode = new CypherBuilder.Node({
                labels: ["Movie"],
            });
            const createQuery = new CypherBuilder.Create(movieNode).return(movieNode);

            const call1 = new CypherBuilder.Call(createQuery);
            const call2 = new CypherBuilder.Call(call1);

            const queryResult = call2.build();
            expect(queryResult.cypher).toMatchInlineSnapshot(`
                "CALL {
                	CALL {
                	CREATE (this0:\`Movie\`)

                RETURN this0
                	RETURN COUNT(*) AS _
                }
                	RETURN COUNT(*) AS _
                }"
            `);
            expect(queryResult.params).toMatchInlineSnapshot(`Object {}`);
        });
    });
});
