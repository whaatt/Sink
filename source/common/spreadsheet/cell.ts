/**
 * A single table cell.
 *
 * The value field is deliberately untyped, since its type is determined by
 * the column type of the cell. The dynamic correspondence between the value
 * and the column type is always preserved.
 *
 * @export
 * @class Cell
 */
export class Cell {
  constructor (public value?: any) {}

  /**
   * Shallow copies this cell.
   *
   * @returns {Cell} A copy cell.
   * @memberof Cell
   */
  public copy (): Cell {
    return new Cell(this.value)
  }
}
