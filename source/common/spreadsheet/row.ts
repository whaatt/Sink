/**
 * A single table row.
 *
 * This is a mostly-empty type definition right now, but in the future a row
 * might have additional properties.
 *
 * @export
 * @class Row
 */
export class Row {
  /**
   * Shallow copies this row.
   *
   * @returns {Row} A copy row.
   * @memberof Row
   */
  public copy (): Row {
    return new Row()
  }
}
