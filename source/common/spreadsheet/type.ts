/**
 * An enhanced enum class of cell types.
 *
 * @export
 * @class Type
 */
export class Type {
  public static Number: Type = new Type()
  public static Text: Type = new Type()

  /**
   * Attempts to coerce the given value to this type. Returns undefined if the
   * coercion fails.
   *
   * @param {object} value The value to coerce.
   * @returns {object} The final value.
   * @memberof Type
   */
  public coerce (value: any): any {
    if (value === undefined) {
      return undefined
    } else if (this === Type.Text) {
      return JSON.stringify(value)
    } else if (this === Type.Number) {
      const result = parseFloat(value)
      return isNaN(result) ? undefined : result
    } else {
      return undefined
    }
  }

  /**
   * Serializes this column type name.
   *
   * @returns {string} A string representation of this column type name.
   * @memberof Type
   */
  public toString (): string {
    if (this === Type.Text) return 'text'
    else if (this === Type.Number) return 'number'
    else return 'undefined'
  }
}
