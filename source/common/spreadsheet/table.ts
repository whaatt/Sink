import { Cell } from './cell'
import { Column } from './column'
import { Row } from './row'

// For self-documentation.
export type IDType = string
export type IndexType = number

/**
 * A single table (spreadsheet).
 *
 * Cells are represented in a nested Row => Column => Cell map of maps. The
 * ordering of rows is stored in an auxiliary data structure.
 *
 * @export
 * @class Table
 */
export class Table {
  /* Public so we can access these directly from common/editor/update. In a
     slightly more production-ready implementation, we might add a layer of
     indirection through individual getters and setters. */
  public cells: Map<IDType, Map<IDType, Cell>> = new Map()
  public rowIndices: Map<IDType, number> = new Map()
  public columns: Map<IDType, Column> = new Map()
  public rows: Row[] = new Array()

  /**
   * Semi-deep copies this table (rows, columns, and cells are each shallow
   * copied).
   *
   * @returns {Table} A copy table.
   * @memberof Table
   */
  public copy (): Table {
    const newTable = new Table()
    this.cells.forEach((row, rowID) => {
      const newMap = new Map()
      newTable.cells.set(rowID, newMap)
      row.forEach((cell, columnID) =>
        newMap.set(columnID, cell))
    })
    this.rowIndices.forEach((index, ID) =>
      newTable.rowIndices.set(ID, index))
    this.columns.forEach((column, ID) =>
      newTable.columns.set(ID, column.copy()))
    this.rows.forEach(row => newTable.rows.push(row.copy()))
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

    this.columns.forEach((column, columnID) => objectJSON['columns'].push({
      id: columnID,
      type: column.type.toString()
    }))

    this.cells.forEach((column, rowID) => objectJSON['rows'].push({
      id: rowID,
      cellValuesByColumnId: Object.assign(Array.from(column)
        .map(([columnID, cell]) => ({ [columnID]: cell.value })))
    }))

    return JSON.stringify(objectJSON, null, spaces)
  }
}
