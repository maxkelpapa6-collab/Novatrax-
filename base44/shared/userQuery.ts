// Lecture des utilisateurs : l'entité User n'accepte pas les options
// (tri, limite, pagination) — on filtre via la requête et on trie en mémoire.
export function userListFromResult(res) {
  return Array.isArray(res) ? res : (res.items || []);
}

export async function filterUsers(admin, query) {
  const res = await admin.entities.User.filter(query);
  const list = userListFromResult(res);
  list.sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
  return list;
}