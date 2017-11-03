import { GroupID, Message, MessageID, ShiftContext, Version }
  from '@common/editor'

import { Client } from './client'
import { Queue } from 'typescript-collections'
import { Table } from '@common/spreadsheet'

/**
 * A table server node.
 *
 * @export
 * @class Server
 */
export class Server {
  private table: Table = new Table()
  private history: Array<Message> = new Array()
  private pending: Queue<Message> = new Queue()
  private failed: Set<GroupID> = new Set()
  private clients: Set<Client> = new Set()
  private version: Version = 0 // Next index.

  // Delay is time between processing intervals; a delay time of zero
  // corresponds to processing messages as soon as they are received.
  constructor (private delay: number = 0) {
    if (delay > 0) setTimeout(() => this.process(), delay)
  }

  /**
   * Reports that the passed client is now online, and syncs the client to
   * the current table state.
   *
   * @param {Client} client The connecting client.
   * @memberof Server
   */
  public connected (client: Client): void {
    this.clients.add(client)
    client.sync(this.table.copy(), this.version)
  }

  /**
   * Reports that the passed client is now offline.
   *
   * @param {Client} client The disconnecting client.
   * @memberof Server
   */
  public disconnected (client: Client): void {
    this.clients.delete(client)
  }

  /**
   * Receives a new update message from a client. If delay mode is off, the
   * message will be processed immediately.
   *
   * @param {Message} message The message.
   * @memberof Server
   */
  public receive (message: Message): void {
    this.pending.enqueue(message)
    if (this.delay === 0) this.process()
  }

  /**
   * Gets the table data for this node.
   *
   * @returns {string} The JSON-serialized table data.
   * @memberof Server
   */
  public getData (): string {
    return this.table.serialize()
  }

  // Broadcast a materialized message.
  private accept (message: Message): void {
    this.clients.forEach((client) => client.accepted(message))
  }

  // Broadcast a failure of a message.
  private reject (messageID: MessageID, groupID: GroupID) {
    this.clients.forEach((client) => client.rejected(messageID, groupID))
  }

  // Processes the message queue.
  private process (): void {
    while (!this.pending.isEmpty()) {
      const message = this.pending.dequeue()

      // If this message depends on failures, reject it.
      if (this.failed.has(message.groupID)) continue

      // Modify update indices as necessary.
      if (message.update.needsTransform()) {
        const shiftContext = new ShiftContext()
        // Accumulate any shift transforms since the message was created.
        for (let i = message.version; i <= this.version; i += 1) {
          this.history[i].update.shift(shiftContext)
        }

        // Apply the cumulative transform.
        message.update.transform(shiftContext)
      }

      // Update SHOULD NOT leave side effects on failure.
      const success = message.update.apply(this.table)

      if (success) {
        this.version += 1
        message.version = this.version
        this.history[this.version] = message
        this.accept(message)
      } else {
        this.failed.add(message.groupID)
        this.reject(message.UUID, message.groupID)
      }
    }
  }
}
