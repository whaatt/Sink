import { ColumnID, Index, RowID, Table, Type } from 'common/spreadsheet'

import { ShiftContext } from './shiftContext'

/**
 * A generic update to a table.
 *
 * @export
 * @interface TableUpdate
 */
export abstract class TableUpdate {
  /**
   * Returns whether this update has indices to be transformed.
   *
   * @returns {boolean} Whether this update has indices to be transformed.
   * @memberof TableUpdate
   */
  needsTransform (): boolean {
    return false
  }

  /**
   * Transforms this update based on the given shift context.
   *
   * @param {ShiftContext} context The shift context
   * @memberof TableUpdate
   */
  transform (context: ShiftContext): void {
    return // No-op.
  }

  /**
   * Mutates a table according to this message. Returns true on success, or
   * false if the message ran into an irreconcilable merge conflict.
   *
   * @param {Table} table The table to mutate.
   * @returns {boolean} Whether the merge was successful.
   * @memberof Update
   */
  abstract apply (table: Table): boolean

  /**
   * Modifies the passed shift context based on this materialized update. If
   * the update has not yet been materialized through apply, this method will
   * throw an Error.
   *
   * @param {ShiftContext} context The shift context to modify.
   * @memberof Update
   */
  shift (context: ShiftContext): void {
    return // No-op.
  }
}

export namespace TableUpdate {
  /**
   * A row creation update.
   *
   * @export
   * @class CreateRow
   * @implements {TableUpdate}
   */
  export class CreateRow extends TableUpdate {
    constructor (private rowID: RowID) {
      super()
    }

    apply (table: Table): boolean {
      if (table.rows.has(this.rowID)) {
        return false
      }

      table.cells.set(this.rowID, new Map())
      table.order.push(this.rowID)
      table.computeRowMap()
      return true
    }
  }

  /**
   * A row deletion update.
   *
   * @export
   * @class DestroyRow
   * @implements {TableUpdate}
   */
  export class DestroyRow extends TableUpdate {
    private index: number = -1 // Saves final index.
    constructor (private rowID: RowID) {
      super()
    }

    apply (table: Table): boolean {
      if (!table.rows.has(this.rowID)) {
        return false
      }

      // Ugly cast to number silences a compiler error due to get() returning
      // potentially undefined, which cannot happen because we check it above.
      this.index = table.rows.get(this.rowID) as number

      table.cells.delete(this.rowID)
      table.order.splice(this.index, 1)
      table.computeRowMap()
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
  export class MoveRow extends TableUpdate {
    private start: number = -1 // Saves final start index.
    constructor (private rowID: RowID, private targetIndex: Index) {
      super()
    }

    transform (context: ShiftContext): void {
      this.targetIndex = context.transform(this.targetIndex)
    }

    apply (table: Table): boolean {
      if (!table.rows.has(this.rowID)) {
        return false
      }

      // Ugly cast to number silences a compiler error due to get() returning
      // potentially undefined, which cannot happen because we check it above.
      this.start = table.rows.get(this.rowID) as number

      const rowID = table.order.splice(this.start, 1)[0]
      table.order.splice(this.targetIndex, 0, rowID)
      table.computeRowMap()
      return true
    }

    shift (context: ShiftContext): void {
      if (this.start === -1) throw new Error('shift called before apply')
      context.move(this.start, this.targetIndex)
    }
  }

  /**
   * A column creation update.
   *
   * @export
   * @class CreateColumn
   * @implements {TableUpdate}
   */
  export class CreateColumn extends TableUpdate {
    constructor (private columnID: ColumnID, private columnType: Type) {
      super()
    }

    apply (table: Table): boolean {
      if (table.columns.has(this.columnID)) {
        return false
      }

      table.columns.set(this.columnID, this.columnType)
      return true
    }
  }

  /**
   * A column deletion update.
   *
   * @export
   * @class DestroyColumn
   * @implements {TableUpdate}
   */
  export class DestroyColumn extends TableUpdate {
    constructor (private columnID: ColumnID) {
      super()
    }

    apply (table: Table): boolean {
      if (!table.columns.has(this.columnID)) {
        return false
      }

      table.columns.delete(this.columnID)
      table.cells.forEach((columns) => columns.delete(this.columnID))
      return true
    }
  }

  /**
   * A column type update.
   *
   * @export
   * @class UpdateColumnType
   * @implements {TableUpdate}
   */
  export class UpdateColumnType extends TableUpdate {
    constructor (private columnID: ColumnID, private columnType: Type) {
      super()
    }

    apply (table: Table): boolean {
      if (!table.columns.has(this.columnID)) {
        return false
      }

      let canCoerce = true
      // Can whole column can be coerced?
      table.cells.forEach((columns) => {
        const cell = columns.get(this.columnID)
        if (this.columnType.coerce(cell) === undefined) canCoerce = false
      })

      if (!canCoerce) return false
      // Whole column can be coerced.
      table.cells.forEach((columns) => {
        const cell = columns.get(this.columnID)
        columns.set(this.columnID, this.columnType.coerce(cell))
      })

      return true
    }
  }

  /**
   * A text cell update.
   *
   * @export
   * @class UpdateTextCellValue
   * @implements {TableUpdate}
   */
  export class UpdateTextCellValue extends TableUpdate {
    constructor (
      private rowID: RowID,
      private columnID: ColumnID,
      private cellValue: string) {
      super()
    }

    apply (table: Table): boolean {
      // Verify that the Row and Column pair exists.
      const type = table.columns.get(this.columnID)
      if (type === undefined) return false
      const index = table.rows.get(this.rowID)
      if (index === undefined) return false

      // Verify column type.
      if (type !== Type.Text) {
        return false
      }

      const rowColumns = table.cells.get(this.rowID) as Map<ColumnID, any>
      rowColumns.set(this.columnID, this.cellValue)
      return true
    }
  }

  /**
   * A number cell update.
   *
   * @export
   * @class UpdateNumberCellValue
   * @implements {TableUpdate}
   */
  export class UpdateNumberCellValue extends TableUpdate {
    constructor (
      private rowID: RowID,
      private columnID: ColumnID,
      private cellValue: number) {
      super()
    }

    apply (table: Table): boolean {
      // Verify that the Row and Column pair exists.
      const type = table.columns.get(this.columnID)
      if (type === undefined) return false
      const index = table.rows.get(this.rowID)
      if (index === undefined) return false

      // Verify column type.
      if (type !== Type.Number) {
        return false
      }

      const rowColumns = table.cells.get(this.rowID) as Map<ColumnID, any>
      rowColumns.set(this.columnID, this.cellValue)
      return true
    }
  }
}
