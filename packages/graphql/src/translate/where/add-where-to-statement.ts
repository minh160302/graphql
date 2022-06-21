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

import { GraphQLWhereArg, Context } from "../../types";
import { Node } from "../../classes";
import mapToDbProperty from "../../utils/map-to-db-property";
import * as CypherBuilder from "../cypher-builder/CypherBuilder";
import { MatchableElement } from "../cypher-builder/MatchPattern";
import { WhereOperator } from "../cypher-builder/statements/where-operators";
import { whereRegEx, WhereRegexGroups } from "./utils";

export function addWhereToStatement<T extends MatchableElement>({
    targetElement,
    matchStatement,
    whereInput,
    context,
    node,
}: {
    matchStatement: CypherBuilder.Match<T>;
    targetElement: T;
    whereInput: GraphQLWhereArg;
    context: Context;
    node: Node;
}): CypherBuilder.Match<T> {
    const mappedProperties = mapAllProperties({
        whereInput,
        targetElement,
        node,
    });

    matchStatement.where(...mappedProperties);

    return matchStatement;
}

function mapAllProperties<T extends MatchableElement>({
    whereInput,
    node,
    targetElement,
}: {
    whereInput: Record<string, any>;
    node: Node;
    targetElement: T;
}): Array<[T, Record<string, CypherBuilder.Param | CypherBuilder.WhereClause>] | WhereOperator> {
    const resultArray: Array<[T, Record<string, CypherBuilder.Param | CypherBuilder.WhereClause>] | WhereOperator> = [];
    const whereFields = Object.entries(whereInput);

    const leafProperties = whereFields.filter(([key, value]) => key !== "OR" && key !== "AND");
    if (leafProperties.length > 0) {
        const mappedProperties = mapProperties(leafProperties, node);

        resultArray.push([targetElement, mappedProperties]);
    }

    // matchStatement.where([targetElement, mappedProperties]);

    // const operatorFields = whereFields.filter(([key, value]) => key === "OR");
    for (const [key, value] of whereFields) {
        if (key === "OR" || key === "AND") {
            // value is an array
            const nestedResult: any[] = [];
            for (const nestedValue of value) {
                const mapNested = mapAllProperties({ whereInput: nestedValue, node, targetElement });
                nestedResult.push(...mapNested);
            }
            // const nestedProperties = value.map((v) => mapAllProperties({ whereInput: v, node, targetElement }));

            if (key === "OR") {
                const orOperation = CypherBuilder.or(...nestedResult);
                resultArray.push(orOperation);
            }
            if (key === "AND") {
                const andOperation = CypherBuilder.and(...nestedResult);
                resultArray.push(andOperation);
            }
        }
    }

    /* TO IMPLEMENT
        * coalesce
        * Relationship fields
        * Connection Fields
        * where clauses (NOT, LG)...

    */

    return resultArray;
}

function mapProperties(
    properties: Array<[string, any]>,
    node: Node
): Record<string, CypherBuilder.Param | CypherBuilder.WhereClause> {
    return properties.reduce((acc, [key, value]) => {
        const match = whereRegEx.exec(key);

        const { fieldName, isAggregate, operator } = match?.groups as WhereRegexGroups;
        const coalesceValue = [...node.primitiveFields, ...node.temporalFields, ...node.enumFields].find(
            (f) => fieldName === f.fieldName
        )?.coalesceValue;

        const param = new CypherBuilder.Param(value);
        const dbFieldName = mapToDbProperty(node, fieldName);

        if (operator) {
            let whereClause: CypherBuilder.WhereClause;
            switch (operator) {
                case "IN":
                    whereClause = CypherBuilder.in(param);
                    break;
                default:
                    throw new Error(`Invalid operator ${operator}`);
            }
            acc[dbFieldName] = whereClause;
        } else {
            acc[dbFieldName] = param;
        }

        return acc;

        // const property =
        //     coalesceValue !== undefined
        //         ? `coalesce(${varName}.${dbFieldName}, ${coalesceValue})`
        //         : `${varName}.${dbFieldName}`;

        return acc;
    }, {});
}
