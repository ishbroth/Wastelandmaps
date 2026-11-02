// Places with no photo to find on Wikimedia, whose "before" picture was supplied by the site owner. Their snapshot is a normal paid one (second tier).
export const MANUAL_BEFORE: Record<string, string> = {
  'famous:east-county-courthouse-el-cajon-': 'renders/famous-east-county-courthouse-el-cajon-source.jpg',
};

export const manualBefore = (spotId: string): string | null => (MANUAL_BEFORE[spotId] ? `${import.meta.env.BASE_URL}${MANUAL_BEFORE[spotId]}` : null);
