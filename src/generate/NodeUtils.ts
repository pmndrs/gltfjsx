import { curry } from 'es-toolkit'
import { InterfaceDeclaration, PropertySignature } from 'ts-morph'

import { PropertyUtils } from './PropertyUtils.js'

export class NodeUtils {
  public static sortPropertySignatures(i: InterfaceDeclaration): InterfaceDeclaration {
    const existingProperties = i.getProperties()
    const sortedProperties = PropertyUtils.sortByName<PropertySignature>(existingProperties)

    existingProperties.forEach((existing: PropertySignature) => {
      const sortedIndex = sortedProperties.findIndex(curry(PropertyUtils.compareByName)(existing))

      if (sortedIndex < 0) {
        return
      }

      existing.setOrder(sortedIndex)
    })

    return i
  }
}
