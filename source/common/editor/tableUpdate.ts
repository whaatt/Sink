import { Cell, Column, ColumnType, IDType, Row, Table }
  from 'common/spreadsheet'

import { ShiftContext } from './shiftContext'

/**
 * A generic update to a table.
 *
 * @export
 * @interface TableUpdate
 */
export interface TableUpdate {
  /**
   * Mutates a table according to this message and a shift context. Returns
   * true on success, or false if the message ran into an irreconcilable merge
   * conflict.
   *
   * @param {Table} table The table to mutate.
   * @param {ShiftContext} context The shift context to apply.
   * @returns {boolean} Whether the merge was successful.
   * @memberof Update
   */
  apply (table: Table, context: ShiftContext): boolean

  /**
   * Modifies the passed shift context based on this materialized update. If
   * the update has not yet been materialized through apply, this method will
   * throw an Error.
   *
   * @param {ShiftContext} context The shift context to modify.
   * @memberof Update
   */
  shift (context: ShiftContext): void
}

export namespace TableUpdate {
  /**
   * A row creation update.
   *
   * @export
   * @class CreateRow
   * @implements {TableUpdate}
   */
  export class CreateRow implements TableUpdate {
    constructor (private rowID: IDType) {}

    apply (table: Table, context: ShiftContext): boolean {
      if (table.rowIndices.has(this.rowID)) {
        return false
      }

      table.rowIndices.set(this.rowID, table.rows.length)
      table.cells.set(this.rowID, new Map())
      table.rows.push(new Row())
      return true
    }

    shift (context: ShiftContext): void {
      return // No-op.
    }
  }

  /**
   * A row deletion update.
   *
   * @export
   * @class DestroyRow
   * @implements {TableUpdate}
   */
  export class DestroyRow implements TableUpdate {
    private index: number = -1 // Saves final index.
    constructor (private rowID: IDType) {}

    apply (table: Table, context: ShiftContext): boolean {
      if (!table.rowIndices.has(this.rowID)) {
        return false
      }

      // Ugly cast to number silences a compiler error due to get() returning
      // potentially undefined, which cannot happen because we check above.
      this.index = context.transform(Number(table.rowIndices.get(this.rowID)))

      table.rows.splice(this.index, 1)
      table.rowIndices.delete(this.rowID)
      table.cells.delete(this.rowID)
      return true
    }

    shift (context: ShiftContext): void {
      if (this.index === -1) throw new Error('shift called before apply')
      context.deleteAt(this.index)
    }
  }

  /**
   * A row move update.
   *
   * @export
   * @class MoveRow
   * @implements {TableUpdate}
   */
  export class MoveRow implements TableUpdate {
    private start: number = -1 // Saves final start index.
    private end: number = -1 // Saves final end index.
    constructor (private rowID: IDType, private targetIndex: number) {}

    apply (table: Table, context: ShiftContext): boolean {
      if (!table.rowIndices.has(this.rowID)) {
        return false
      }

      // Ugly cast to number silences a compiler error due to get() returning
      // potentially undefined, which cannot happen because we check above.
      this.start = context.transform(Number(table.rowIndices.get(this.rowID)))
      this.end = context.transform(this.targetIndex)

      const row = table.rows.splice(this.start, 1)[0]
      table.rows.splice(this.end, 0, row) // Insert at.
      table.rowIndices.set(this.rowID, this.end)
      return true
    }

    shift (context: ShiftContext): void {
      if (this.start === -1) throw new Error('shift called before apply')
      context.move(this.start, this.end)
    }
  }

  /**
   * A column creation update.
   *
   * @export
   * @class CreateColumn
   * @implements {TableUpdate}
   */
  export class CreateColumn implements TableUpdate {
    constructor (
      private columnID: IDType, private columnType: ColumnType) {}

    apply (table: Table, context: ShiftContext): boolean {
      if (table.columns.has(this.columnID)) {
        return false
      }

      table.columns.set(this.columnID, new Column(this.columnType))
      table.cells.forEach((columns) => columns.set(this.columnID, new Cell()))
      return true
    }

    shift (context: ShiftContext): void {
      return // No-op.
    }
  }

  /**
   * A column deletion update.
   *
   * @export
   * @class DestroyColumn
   * @implements {TableUpdate}
   */
  export class DestroyColumn implements TableUpdate {
    constructor (private columnID: IDType) {}

    apply (table: Table, context: ShiftContext): boolean {
      if (!table.columns.has(this.columnID)) {
        return false
      }

      table.columns.delete(this.columnID)
      table.cells.forEach((columns) => columns.delete(this.columnID))
      return true
    }

    shift (context: ShiftContext): void {
      return // No-op.
    }
  }

  /**
   * A column type update.
   *
   * @export
   * @class UpdateColumnType
   * @implements {TableUpdate}
   */
  export class UpdateColumnType implements TableUpdate {
    constructor (private columnID: IDType, private columnType: ColumnType) {}

    apply (table: Table, context: ShiftContext): boolean {
      if (!table.columns.has(this.columnID)) {
        return false
      }

      let canCoerce = true
      // Can whole column can be coerced?
      table.cells.forEach((columns) => {
        const cell = columns.get(this.columnID)
        if (cell !== undefined) {
          if (this.columnType.coerce(cell.value) === undefined) {
            canCoerce = false
          }
        }
      })

      if (!canCoerce) return false
      // Whole column can be coerced.
      table.cells.forEach((columns) => {
        const cell = columns.get(this.columnID)
        if (cell !== undefined) {
          cell.value = this.columnType.coerce(cell.value)
        }
      })

      return true
    }

    shift (context: ShiftContext): void {
      return // No-op.
    }
  }

  /**
   * A text cell update.
   *
   * @export
   * @class UpdateTextCellValue
   * @implements {TableUpdate}
   */
  export class UpdateTextCellValue implements TableUpdate {
    constructor (
      private rowID: IDType,
      private columnID: IDType,
      private cellValue: string) {}

    apply (table: Table, context: ShiftContext): boolean {
      // Verify that the cell at (Row, Column) exists.
      const columns = table.cells.get(this.rowID)
      if (columns === undefined) return false
      const cell = columns.get(this.columnID)
      if (cell === undefined) return false

      // Verify that the cell column type is Text.
      const column = table.columns.get(this.columnID)
      if (column === undefined || column.type !== ColumnType.Text) {
        return false
      }

      cell.value = this.cellValue
      return true
    }

    shift (context: ShiftContext): void {
      return // No-op.
    }
  }

  /**
   * A number cell update.
   *
   * @export
   * @class UpdateNumberCellValue
   * @implements {TableUpdate}
   */
  export class UpdateNumberCellValue implements TableUpdate {
    constructor (
      private rowID: IDType,
      private columnID: IDType,
      private cellValue: string) {}

    apply (table: Table, context: ShiftContext): boolean {
      // Verify that the cell at (Row, Column) exists.
      const columns = table.cells.get(this.rowID)
      if (columns === undefined) return false
      const cell = columns.get(this.columnID)
      if (cell === undefined) return false

      // Verify that the cell column type is Number.
      const column = table.columns.get(this.columnID)
      if (column === undefined || column.type !== ColumnType.Number) {
        return false
      }

      cell.value = this.cellValue
      return true
    }

    shift (context: ShiftContext): void {
      return // No-op.
    }
  }
}
