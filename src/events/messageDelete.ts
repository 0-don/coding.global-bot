import type { Event } from '../types';
import { deleteMessageDb } from '../utils/messages/deleteMessageDb';

export default {
  name: 'messageDelete',
  once: false,
  async execute(message) {
    // add Message to Database for statistics
    await deleteMessageDb(message);
  },
} as Event<'messageDelete'>;
