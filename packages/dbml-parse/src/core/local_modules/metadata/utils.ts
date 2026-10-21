import { MetadataFieldRegistry, MetadataTarget } from '@/core/global_modules/metadata/utils';
import {
  CompileError, CompileErrorCode, MetadataTargetKind, SettingName,
} from '@/core/types';
import type { AttributeNode, ElementDeclarationNode, ListExpressionNode } from '@/core/types/nodes';
import Report from '@/core/types/report';
import { extractMetadataValue } from '@/core/utils/interpret';
import { aggregateSettingList, Settings } from '@/core/utils/validate';

export function getMetadataTargetKind (node: ElementDeclarationNode): MetadataTargetKind | undefined {
  const value = node.targetKind?.value?.toLowerCase();
  return Object.values(MetadataTargetKind).find((k) => k.toLowerCase() === value);
}

export function validateCustomInlineMetadata (
  name: string,
  attrs: AttributeNode[],
  errorCodes: { duplicate: CompileErrorCode; invalidValue: CompileErrorCode },
): CompileError[] {
  const errors: CompileError[] = [];

  if (attrs.length > 1) {
    errors.push(...attrs.map((attr) => new CompileError(
      errorCodes.duplicate,
      `'${name}' can only appear once`,
      attr,
    )));
  }

  attrs.forEach((attr) => {
    if (extractMetadataValue(attr.value) === undefined) {
      errors.push(new CompileError(
        errorCodes.invalidValue,
        `Custom setting '${name}' must be a string, a color literal, a number literal, or a boolean literal`,
        attr.value || attr.name || attr,
      ));
    }
  });

  return errors;
}

export function validateInlineMetadata<T extends MetadataTarget> (
  settingList: ListExpressionNode | undefined,
  fieldsRegistry: MetadataFieldRegistry<T, any>,
  errorCodes: { duplicate: CompileErrorCode; invalidValue: CompileErrorCode },
): Report<Settings> {
  const aggReport = aggregateSettingList(settingList);
  const errors = aggReport.getErrors();
  const settingMap = aggReport.getValue();

  const clean: Settings = {};

  for (const [name, attrs] of Object.entries(settingMap)) {
    if (attrs.length > 1) {
      errors.push(...attrs.map((attr) => new CompileError(errorCodes.duplicate, `'${name}' can only appear once`, attr)));
    }

    if (fieldsRegistry[name]) {
      const specs = fieldsRegistry[name];
      attrs.forEach((attr) => {
        if (specs.parse(attr.value) === undefined) {
          errors.push(new CompileError(
            errorCodes.invalidValue,
            specs.message,
            attr.value || attr.name || attr,
          ));
        }
      });
      clean[name] = attrs;
    } else {
      // Any non-builtin key is free-form inline custom metadata
      errors.push(
        ...attrs
          .filter((attr) => extractMetadataValue(attr.value) === undefined) // Filter attributes that are not valid metadata value
          .map((attr) => new CompileError(errorCodes.invalidValue, `Custom setting '${name}' must be a string, a color literal, a number literal, or a boolean literal`, attr.value || attr.name || attr)),

      );
      clean[name] = attrs;
    }
  }

  return new Report(clean, errors);
}
