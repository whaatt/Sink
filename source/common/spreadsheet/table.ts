import { Type } from './type'

// For self-documenting types.
export type ColumnID = string
export type RowID = string
export type Index = number

// For convenience.
class ColumnOutput {
  // tslint:disable-next-line
  constructor (private id: string, private type: string) {}
}

// For convenience.
class RowOutput {
  // tslint:disable-next-line
  constructor (private id: string, private cellValuesByColumnId: object) {}
}

/**
 * A single table.
 *
 * Cells are represented in a nested Row => Column => Cell map of maps. The
 * ordering of rows and the typing of columns are stored in an auxiliary data
 * structure.
 *
 * @export
 * @class Table
 */
export class Table {
  // In the future, Type and Index could be extracted into classes for Column
  // and Row respectively. For simplicity, we use these raw attributes here.
  public cells: Map<RowID, Map<ColumnID, any>> = new Map()
  public columns: Map<ColumnID, Type> = new Map()
  public rows: Map<RowID, Index> = new Map()
  public order: RowID[] = new Array()

  /**
   * Compute mappings from row IDs to row order indices.
   *
   * @memberof Table
   */
  public computeRowMap (): void {
    this.rows.clear() // Mappings invalidated.
    this.order.forEach((rowID, index) => this.rows.set(rowID, index))
  }

  /**
   * Shallow copies this table.
   *
   * @returns {Table} A copy table.
   * @memberof Table
   */
  public copy (): Table {
    const newTable = new Table()
    this.cells.forEach((column, rowID) => newTable.cells
      .set(rowID, new Map(this.cells.get(rowID) as Map<ColumnID, any>)))
    newTable.columns = new Map(this.columns)
    newTable.rows = new Map(this.rows)
    newTable.order = this.order.slice()
    return newTable
  }

  /**
   * Returns a serialized representation of this table (according to spec).
   *
   * @param {number} [spaces = 0]  The number of spaces for pretty-printing.
   * @returns {string} A JSON-serialized representation of this table.
   * @memberof Table
   */
  public serialize (spaces: number = 0): string {
    const objectJSON: any = {
      columns: [],
      rows: []
    }

    // Add all columns with their types.
    this.columns.forEach((type, columnID) =>
      objectJSON.columns.push(new ColumnOutput(columnID, type.toString())))

    // Add rows with cell values by column.
    this.order.forEach((rowID) => objectJSON.rows
      .push(new RowOutput(rowID, Object.assign({}, ...Array
        .from(this.cells.get(rowID) as Map<ColumnID, any>)
        .map(([columnID, cell]) => ({ [columnID]: cell }))))))

    // Last two parameters specify pretty-print tabbing.
    return JSON.stringify(objectJSON, null, spaces)
  }
}
