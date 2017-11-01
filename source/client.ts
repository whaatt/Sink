import * as UUIDV4 from 'uuid/v4'

import { ColumnID, Index, RowID, Table, Type } from 'common/spreadsheet'
import { GroupID, Message, TableUpdate, Version } from 'common/editor'

import { Queue } from 'typescript-collections'
import { Server } from './server'

/**
 * A table client node.
 *
 * @export
 * @class Client
 */
export class Client {
  private table: Table = new Table()
  private outbox: Queue<Message> = new Queue()
  private groupID: GroupID = UUIDV4()
  private version: Version = 0

  constructor (private server: Server, private online: boolean = true) {
    if (online === true) this.comeOnline()
  }

  /**
   * Connects to the server and sends any pending offline messages.
   *
   * @memberof Client
   */
  public comeOnline (): void {
    this.server.connected(this)
    this.outbox.forEach(item => this.server.receive(item))
    this.outbox.clear()
    this.online = true
  }

  /**
   * Disconnects from the server and goes into offline mode.
   *
   * @memberof Client
   */
  public goOffline (): void {
    this.server.disconnected(this)
    this.online = false
  }

  /**
   * Gets the table data for this node.
   *
   * @returns {string} The JSON-serialized table data.
   * @memberof Client
   */
  public getData (): string {
    // If online, just return the ground truth table.
    if (this.online) return this.table.serialize()

    const outTable = this.table.copy()
    // If offline, apply pending updates to the table as well.
    this.outbox.forEach(item => item.update.apply(outTable))
    return outTable.serialize()
  }

  /**
   * Creates a row.
   *
   * @param {RowID} rowID The new row ID.
   * @memberof Client
   */
  public createRow (rowID: RowID) {
    const update = new TableUpdate.CreateRow(rowID)
    const message = new Message(this.version, this.groupID, update)
    this.send(message)
  }

  /**
   * Destroys a row.
   *
   * @param {RowID} rowID The row ID.
   * @memberof Client
   */
  public destroyRow (rowID: RowID) {
    const update = new TableUpdate.DestroyRow(rowID)
    const message = new Message(this.version, this.groupID, update)
    this.send(message)
  }

  /**
   * Moves a row.
   *
   * @param {RowID} rowID The row ID.
   * @param {Index} targetIndex The move target index.
   * @memberof Client
   */
  public moveRow (rowID: RowID, targetIndex: Index) {
    const update = new TableUpdate.MoveRow(rowID, targetIndex)
    const message = new Message(this.version, this.groupID, update)
    this.send(message)
  }

  /**
   * Creates a column.
   *
   * @param {ColumnID} columnID The new column ID.
   * @param {Type} columnType The new column type.
   * @memberof Client
   */
  public createColumn (columnID: ColumnID, columnType: Type) {
    const update = new TableUpdate.CreateColumn(columnID, columnType)
    const message = new Message(this.version, this.groupID, update)
    this.send(message)
  }

  /**
   * Destroys a column.
   *
   * @param {ColumnID} columnID The column ID.
   * @memberof Client
   */
  public destroyColumn (columnID: ColumnID) {
    const update = new TableUpdate.DestroyColumn(columnID)
    const message = new Message(this.version, this.groupID, update)
    this.send(message)
  }

  /**
   * Updates a column type.
   *
   * @param {ColumnID} columnID The column ID.
   * @param {Type} columnType The new column type.
   * @memberof Client
   */
  public updateColumnType (columnID: ColumnID, columnType: Type) {
    const update = new TableUpdate.UpdateColumnType(columnID, columnType)
    const message = new Message(this.version, this.groupID, update)
    this.send(message)
  }

  /**
   * Updates the value of a text cell.
   *
   * @param {RowID} rowID The row ID of the cell.
   * @param {ColumnID} columnID The column ID of the cell.
   * @param {string} value The new value for the cell.
   * @memberof Client
   */
  public updateTextCellValue (
    rowID: RowID, columnID: ColumnID, value: string) {
    const update = new TableUpdate.UpdateTextCellValue(rowID, columnID, value)
    const message = new Message(this.version, this.groupID, update)
    this.send(message)
  }

  /**
   * Updates the value of a number cell.
   *
   * @param {RowID} rowID The row ID of the cell.
   * @param {ColumnID} columnID The column ID of the cell.
   * @param {number} value The new value for the cell.
   * @memberof Client
   */
  public updateNumberCellValue (
    rowID: RowID, columnID: ColumnID, value: number) {
    const update = new TableUpdate
      .UpdateNumberCellValue(rowID, columnID, value)
    const message = new Message(this.version, this.groupID, update)
    this.send(message)
  }

  /**
   * Syncs this client to the latest table state. If the latest state is newer
   * than the last client state, reset the group ID as well.
   *
   * @param {Table} table The table state.
   * @param {Version} version The state version.
   * @memberof Client
   */
  public sync (table: Table, version: Version): void {
    if (version > this.version) this.groupID = UUIDV4()
    this.version = version
    this.table = table
  }

  /**
   * Receives an acceptance notification for a message.
   *
   * @param {Message} message The message.
   * @memberof Client
   */
  public accepted (message: Message): void {
    if (message.version !== this.version + 1) {
      throw new Error('unexpected version')
    }

    message.update.apply(this.table)
    this.version = message.version
    this.groupID = UUIDV4()
  }

  // Sends a message or stashes it.
  private send (message: Message) {
    if (this.online) this.server.receive(message)
    else this.outbox.enqueue(message)
  }
}
