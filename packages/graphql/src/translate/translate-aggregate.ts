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

import { Node } from "../classes";
import { AUTH_FORBIDDEN_ERROR } from "../constants";
import { Context, GraphQLWhereArg } from "../types";
import createAuthAndParams from "./create-auth-and-params";
import createWhereAndParams from "./create-where-and-params";

function translateAggregate({ node, context }: { node: Node; context: Context }): [string, any] {
    const whereInput = context.resolveTree.args.where as GraphQLWhereArg;
    const fieldsByTypeName = context.resolveTree.fieldsByTypeName;
    const varName = "this";
    let cypherParams: { [k: string]: any } = {};
    const whereStrs: string[] = [];
    const cypherStrs: string[] = [];

    cypherStrs.push(`MATCH (${varName}:${node.name})`);

    if (whereInput) {
        const where = createWhereAndParams({
            whereInput,
            varName,
            node,
            context,
            recursing: true,
        });
        if (where[0]) {
            whereStrs.push(where[0]);
            cypherParams = { ...cypherParams, ...where[1] };
        }
    }

    const whereAuth = createAuthAndParams({
        operation: "READ",
        entity: node,
        context,
        where: { varName, node },
    });
    if (whereAuth[0]) {
        whereStrs.push(whereAuth[0]);
        cypherParams = { ...cypherParams, ...whereAuth[1] };
    }

    if (whereStrs.length) {
        cypherStrs.push(`WHERE ${whereStrs.join(" AND ")}`);
    }

    const allowAuth = createAuthAndParams({
        operation: "READ",
        entity: node,
        context,
        allow: {
            parentNode: node,
            varName,
        },
    });
    if (allowAuth[0]) {
        cypherStrs.push(`CALL apoc.util.validate(NOT(${allowAuth[0]}), "${AUTH_FORBIDDEN_ERROR}", [0])`);
        cypherParams = { ...cypherParams, ...allowAuth[1] };
    }

    const selections = fieldsByTypeName[`${node.name}AggregateSelection`];
    const projections: string[] = [];
    let withStrs: string[] = [];
    const authStrs: string[] = [];

    // Do auth first so we can throw out before aggregating
    Object.entries(selections).forEach((selection) => {
        const authField = node.authableFields.find((x) => x.fieldName === selection[0]);
        if (authField) {
            if (authField.auth) {
                const allowAndParams = createAuthAndParams({
                    entity: authField,
                    operation: "READ",
                    context,
                    allow: { parentNode: node, varName, chainStr: authField.fieldName },
                });
                if (allowAndParams[0]) {
                    authStrs.push(allowAndParams[0]);
                    cypherParams = { ...cypherParams, ...allowAndParams[1] };
                }
            }
        }
    });

    if (authStrs.length) {
        cypherStrs.push(`CALL apoc.util.validate(NOT(${authStrs.join(" AND ")}), "${AUTH_FORBIDDEN_ERROR}", [0])`);
    }

    Object.entries(selections).forEach((selection) => {
        if (selection[0] === "count") {
            cypherStrs.push(`WITH count(${varName}) AS thisCount`);
            withStrs.push(`thisCount`);
            projections.push(`count: thisCount`);
        }

        const primitiveField = node.primitiveFields.find((x) => x.fieldName === selection[0]);
        if (primitiveField) {
            const isNumerical = ["Int", "Float", "BigInt"].includes(primitiveField.typeMeta.name);

            if (isNumerical) {
                const thisAggregations: string[] = [];
                const thisVars: string[][] = [];

                Object.entries(
                    selection[1].fieldsByTypeName[`${primitiveField.typeMeta.name}AggregationSelection`]
                ).forEach((entry) => {
                    // "min" | "max" | "average"
                    let operator = entry[0];
                    if (operator === "average") {
                        operator = "avg";
                    }

                    const variableName = `${operator}${selection[0]}`;
                    thisAggregations.push(`${operator}(this.${primitiveField.fieldName}) AS ${variableName}`);
                    thisVars.push([entry[0], variableName]);
                });

                cypherStrs.push(`WITH ${thisAggregations.join(", ")}`);
                projections.push(`${primitiveField.fieldName}: { ${thisVars.map((x) => `${x[0]}: ${x[1]}`)} }`);
                withStrs = withStrs.concat(thisVars.map((x) => x[1]));
            } else {
                // TODO
            }
        }

        // const dateTimeField = node.dateTimeFields.find((x) => x.fieldName === selection[0]);
        // if (dateTimeField) {
        // }
    });

    cypherStrs.push(`WITH ${withStrs.join(", ")}`);
    cypherStrs.push(`RETURN { ${projections.join(", ")} }`);

    return [cypherStrs.filter(Boolean).join("\n"), cypherParams];
}

export default translateAggregate;
