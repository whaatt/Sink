/**
 * The type of index shift.
 *
 * @export
 * @enum {number}
 */
enum ShiftType {
  Insert,
  Delete
}

/**
 * A record of a shift (type and positions).
 *
 * @export
 * @interface ShiftRecord
 */
class ShiftRecord {
  constructor (public type: ShiftType, public index: number) {}
}

/**
 * Represents cumulative changes to the indices of an array. Exposes a helper
 * function to transform an old index into the present context.
 *
 * @export
 * @class ShiftContext
 */
export class ShiftContext {
  private shifts: ShiftRecord[] = new Array()

  /**
   * Records an insertion.
   *
   * @param {number} index Insertion index.
   * @memberof ShiftContext
   */
  public insertAt (index: number): void {
    this.shifts.push(new ShiftRecord(ShiftType.Insert, index))
  }

  /**
   * Records a deletion.
   *
   * @param {number} index Deletion index.
   * @memberof ShiftContext
   */
  public deleteAt (index: number): void {
    this.shifts.push(new ShiftRecord(ShiftType.Delete, index))
  }

  /**
   * Records a move as a delete and an insert.
   *
   * @param {number} start Move start index.
   * @param {number} end Move end index.
   * @memberof ShiftContext
   */
  public move (start: number, end: number): void {
    this.shifts.push(new ShiftRecord(ShiftType.Delete, start))
    this.shifts.push(new ShiftRecord(ShiftType.Insert, end))
  }

  /**
   * Transforms the given index based on this shift. If the index was deleted
   * during transformation, this method returns -1.
   *
   * @param {number} index The index to transform.
   * @returns {number} The transformed index.
   * @memberof ShiftContext
   */
  public transform (index: number): number {
    this.shifts.forEach(shift => {
      if (shift.type === ShiftType.Insert) {
        index += index >= shift.index ? 1 : 0
      } else if (shift.type === ShiftType.Delete) {
        if (index === shift.index) return -1
        index -= index > shift.index ? 1 : 0
      }
    })

    return index
  }
}
