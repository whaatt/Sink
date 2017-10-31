/**
 * An enhanced enum class of column types.
 *
 * @export
 * @class ColumnType
 */
export class ColumnType {
  public static Number: ColumnType = new ColumnType()
  public static Text: ColumnType = new ColumnType()

  /**
   * Attempts to coerce the given value to this type. Returns undefined if the
   * coercion fails.
   *
   * @param {object} value The value to coerce.
   * @returns {object} The final value.
   * @memberof ColumnType
   */
  public coerce (value: any): any {
    if (this === ColumnType.Text) {
      return JSON.stringify(value)
    } else if (this === ColumnType.Number) {
      const result = parseFloat(value)
      return isNaN(result) ? undefined : result
    } else {
      return undefined
    }
  }

  /**
   * Serializes this column name.
   *
   * @returns {string} A string representation of this column name.
   * @memberof ColumnType
   */
  public toString (): string {
    if (this === ColumnType.Text) return 'text'
    else if (this === ColumnType.Number) return 'number'
    else return 'undefined'
  }
}

/**
 * A single table column.
 *
 * This is just a shim over ColumnType right now, but in reality we might have
 * other properties on a single column.
 *
 * @export
 * @class Column
 */
export class Column {
  constructor (public type: ColumnType) {}

  /**
   * Shallow copies this column.
   *
   * @returns {Column} A copy column.
   * @memberof Column
   */
  public copy (): Column {
    return new Column(this.type)
  }
}
