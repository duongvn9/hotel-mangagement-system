import { model } from 'mongoose';
import { EquipmentSchema } from './schemas/equipment.schema.js';
import { EquipmentService } from './equipment.service.js';

const Equipment = model('UC35SchemaEquipment', EquipmentSchema);
describe('Equipment foundation', () => {
  it('trims asset/name/category, defaults GOOD/active and allows no room', async () => {
    const item = new Equipment({
      assetCode: ' A-1 ',
      name: ' TV ',
      category: ' Điện tử ',
    });
    await expect(item.validate()).resolves.toBeUndefined();
    expect(item.toObject()).toMatchObject({
      assetCode: 'A-1',
      name: 'TV',
      category: 'Điện tử',
      condition: 'GOOD',
      isActive: true,
    });
    expect(item.room).toBeUndefined();
    expect(EquipmentSchema.options.collection).toBe('equipment');
    expect(EquipmentSchema.indexes()).toContainEqual([
      { assetCode: 1 },
      { unique: true },
    ]);
  });
  it.each([
    { name: undefined },
    { name: ' ' },
    { category: undefined },
    { category: ' ' },
    { assetCode: undefined },
    { condition: 'UNKNOWN' },
    { room: 'invalid' },
  ])('rejects invalid schema fields %j', async (change) => {
    await expect(
      new Equipment({
        assetCode: 'A',
        name: 'TV',
        category: 'Điện tử',
        ...change,
      }).validate(),
    ).rejects.toThrow();
  });
  it('marks only GOOD equipment FAULTY, preserving UNDER_REPAIR/FAULTY', async () => {
    const updateOne = vi.fn().mockResolvedValue({});
    const service = new EquipmentService({ updateOne } as never);
    await service.markFaulty('id');
    expect(updateOne).toHaveBeenCalledWith(
      { _id: 'id', isActive: true, condition: 'GOOD' },
      { $set: { condition: 'FAULTY' } },
      { runValidators: true },
    );
  });
});
