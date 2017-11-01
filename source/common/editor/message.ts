import * as UUIDV4 from 'uuid/v4'

import { TableUpdate } from './tableUpdate'

// For self-documentation.
export type MessageID = string
export type GroupID = string
export type Version = number

/**
 * An edit or acknowledgment message between nodes.
 *
 * Messages are specified as a 4-tuple, consisting of a version number to
 * modify from, a grouping ID for dependent updates, the specific update to be
 * applied, and a UUID for each update.
 *
 * @export
 * @class Message
 */
export class Message {
  constructor (
    public version: Version,
    public groupID: GroupID,
    public update: TableUpdate,
    public UUID: MessageID = UUIDV4()) {}
}
