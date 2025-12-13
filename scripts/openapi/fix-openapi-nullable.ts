/**
 * Post-process OpenAPI spec to fix nullable fields
 *
 * Converts invalid nullable syntax to OpenAPI 3.1.0 compliant format
 */

import * as fs from "fs";
import * as path from "path";

const specPath = path.join(process.cwd(), "openapi.json");
const spec = JSON.parse(fs.readFileSync(specPath, "utf-8"));

/**
 * Recursively fix nullable fields in the OpenAPI spec
 */
function fixNullableFields(obj: any): any {
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(fixNullableFields);
  }

  // Check if this object has both "type" and "nullable": true
  if (obj.type && obj.nullable === true) {
    const { nullable, ...rest } = obj;
    // Convert to OpenAPI 3.1.0 format: type can be an array including "null"
    return {
      ...rest,
      type: [obj.type, "null"],
    };
  }

  // Check if this is a property with anyOf containing nullable
  if (obj.anyOf && Array.isArray(obj.anyOf)) {
    // Find the actual type schema (not the nullable ones)
    const typeSchema = obj.anyOf.find(
      (item: any) => item.type && !item.nullable
    );

    // Check if there are nullable items
    const hasNullable = obj.anyOf.some((item: any) => item.nullable === true);

    if (typeSchema && hasNullable) {
      // Convert to OpenAPI 3.1.0 format: type can be an array including "null"
      const baseType = typeSchema.type;
      const result = {
        ...typeSchema,
        type: [baseType, "null"],
      };

      // Preserve other properties like description, example, etc.
      if (obj.description) result.description = obj.description;
      if (obj.example !== undefined) result.example = obj.example;

      return result;
    }
  }

  // Recursively process all properties
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = fixNullableFields(value);
  }

  return result;
}

// Fix the spec
const fixedSpec = fixNullableFields(spec);

// Write back to file
fs.writeFileSync(specPath, JSON.stringify(fixedSpec, null, 2));

console.log(`✅ Fixed nullable fields in OpenAPI spec`);
console.log(`📝 Updated: ${specPath}`);
