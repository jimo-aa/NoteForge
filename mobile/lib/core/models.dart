class AuthUser {
  final String id;
  final String username;
  final String email;
  final String? avatar;

  AuthUser({required this.id, required this.username, required this.email, this.avatar});

  factory AuthUser.fromJson(Map<String, dynamic> json) => AuthUser(
        id: json['id'] as String? ?? '',
        username: json['name'] as String? ?? json['username'] as String? ?? '',
        email: json['email'] as String? ?? '',
        avatar: json['avatarUrl'] as String?,
      );
}

class NoteItem {
  final String id;
  final String userId;
  final String? notebookId;
  final String title;
  final String content;
  final String contentPlain;
  final List<String> tags;
  final bool isPinned;
  final bool isFavorite;
  final int wordCount;
  final int version;
  final int createdAt;
  final int updatedAt;

  NoteItem({
    required this.id,
    this.userId = '',
    this.notebookId,
    this.title = '',
    this.content = '',
    this.contentPlain = '',
    this.tags = const [],
    this.isPinned = false,
    this.isFavorite = false,
    this.wordCount = 0,
    this.version = 1,
    this.createdAt = 0,
    this.updatedAt = 0,
  });

  factory NoteItem.fromJson(Map<String, dynamic> json) => NoteItem(
        id: json['id'] as String? ?? '',
        userId: json['userId'] as String? ?? '',
        notebookId: json['notebookId'] as String?,
        title: json['title'] as String? ?? '',
        content: json['content'] as String? ?? '',
        contentPlain: json['contentPlain'] as String? ?? '',
        tags: (json['tags'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
        isPinned: json['isPinned'] as bool? ?? false,
        isFavorite: json['isFavorite'] as bool? ?? false,
        wordCount: (json['wordCount'] as num?)?.toInt() ?? 0,
        version: (json['version'] as num?)?.toInt() ?? 1,
        createdAt: (json['createdAt'] as num?)?.toInt() ?? 0,
        updatedAt: (json['updatedAt'] as num?)?.toInt() ?? 0,
      );

  Map<String, dynamic> toJson() => {
        'title': title,
        'content': content,
        'notebookId': notebookId,
        'tags': tags,
        'isPinned': isPinned,
        'isFavorite': isFavorite,
      };
}

class Notebook {
  final String id;
  final String name;
  final String icon;
  final String color;
  final int noteCount;

  Notebook({required this.id, this.name = '', this.icon = '📓', this.color = '#6366f1', this.noteCount = 0});

  factory Notebook.fromJson(Map<String, dynamic> json) => Notebook(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        icon: json['icon'] as String? ?? '📓',
        color: json['color'] as String? ?? '#6366f1',
        noteCount: (json['noteCount'] as num?)?.toInt() ?? 0,
      );
}

class Tag {
  final String id;
  final String name;
  final String color;
  final int noteCount;

  Tag({required this.id, this.name = '', this.color = '#6366f1', this.noteCount = 0});

  factory Tag.fromJson(Map<String, dynamic> json) => Tag(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        color: json['color'] as String? ?? '#6366f1',
        noteCount: (json['noteCount'] as num?)?.toInt() ?? 0,
      );
}
