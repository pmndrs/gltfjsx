import { PropertyAssignment, PropertySignature } from 'ts-morph'

import { stripQuotes } from './utils.js'

type Property = PropertyAssignment | PropertySignature

// note: cannot use `this` because of curry external and internal `this` conflict

export class PropertyUtils {
  public static compareByName(a: Property | string, b: Property | string) {
    return PropertyUtils.strip(a) === PropertyUtils.strip(b)
  }

  public static getNames(properties: Property[]): string[] {
    return properties.map(PropertyUtils.strip)
  }

  public static sortByName<TProperty extends Property = Property>(
    properties: Property[],
  ): TProperty[] {
    return properties.sort((a, b) =>
      PropertyUtils.strip(a).localeCompare(PropertyUtils.strip(b)),
    ) as TProperty[]
  }

  private static strip(property: Property | string) {
    return stripQuotes(typeof property == 'string' ? property : property.getName())
  }
}
