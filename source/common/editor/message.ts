import * as UUIDV4 from 'uuid/v4'

import { TableUpdate } from './tableUpdate'

/**
 * An edit or acknowledgment message between nodes.
 *
 * Messages are specified as a 3-tuple, consisting of a UUID, a synced version
 * number to modify from, and a specification for a table update. When an edit
 * fails, the message will be returned (unicast) to the sender and the failed
 * bit will be set. When an edit succeeds, the version number will be updated
 * to reflect reality and the message will be broadcast to all nodes.
 *
 * @export
 * @class Message
 */
export class Message {
  constructor (
    public version: number,
    public update: TableUpdate,
    public UUID: string = UUIDV4(),
    public failed: boolean = false) {}
}
