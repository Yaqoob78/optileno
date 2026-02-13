interface SupabaseClient {
  from: (table: string) => any;
}

const supabase: SupabaseClient = {
  from: (table: string) => ({
    insert: async (data: any) => ({ data, error: null }),
    select: () => ({ data: [], error: null }),
    update: async () => ({ data: null, error: null }),
    delete: async () => ({ data: null, error: null }),
  }),
};

interface SavedChat {
  id: string;
  user_id: string;
  title: string;
  messages: any[];
  mode: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  summary?: string;
}

export const keepModeService = {
  async saveChat(
    userId: string,
    title: string,
    messages: any[],
    mode: string,
    tags: string[] = []
  ): Promise<SavedChat> {
    const { data, error } = await supabase
      .from('saved_chats')
      .insert([
        {
          user_id: userId,
          title,
          messages,
          mode,
          tags,
          summary: messages[messages.length - 1]?.content.substring(0, 100),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async loadChat(chatId: string): Promise<SavedChat> {
    const { data, error } = await supabase
      .from('saved_chats')
      .select('*')
      .eq('id', chatId)
      .single();

    if (error) throw error;
    return data;
  },

  async getSavedChats(userId: string): Promise<SavedChat[]> {
    const { data, error } = await supabase
      .from('saved_chats')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async updateChat(
    chatId: string,
    title: string,
    messages: any[]
  ): Promise<SavedChat> {
    const { data, error } = await supabase
      .from('saved_chats')
      .update({
        title,
        messages,
        updated_at: new Date().toISOString(),
      })
      .eq('id', chatId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteChat(chatId: string): Promise<void> {
    const { error } = await supabase
      .from('saved_chats')
      .delete()
      .eq('id', chatId);

    if (error) throw error;
  },

  async searchChats(userId: string, query: string): Promise<SavedChat[]> {
    const { data, error } = await supabase
      .from('saved_chats')
      .select('*')
      .eq('user_id', userId)
      .or(`title.ilike.%${query}%,summary.ilike.%${query}%`)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async archiveChat(chatId: string): Promise<void> {
    const { error } = await supabase
      .from('saved_chats')
      .update({ archived: true })
      .eq('id', chatId);

    if (error) throw error;
  },
};
