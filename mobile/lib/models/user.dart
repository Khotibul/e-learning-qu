enum Role { admin, guru, siswa, researcher }

Role roleFromString(String s) {
  switch (s) {
    case "ADMIN": return Role.admin;
    case "GURU": return Role.guru;
    case "SISWA": return Role.siswa;
    case "RESEARCHER": return Role.researcher;
    default: return Role.siswa;
  }
}

String roleToString(Role r) {
  switch (r) {
    case Role.admin: return "ADMIN";
    case Role.guru: return "GURU";
    case Role.siswa: return "SISWA";
    case Role.researcher: return "RESEARCHER";
  }
}

class User {
  final String id;
  final String email;
  final String? name;
  final String? image;
  final Role role;

  User({required this.id, required this.email, this.name, this.image, required this.role});

  factory User.fromJson(Map<String, dynamic> j) => User(
    id: j["id"] as String,
    email: j["email"] as String,
    name: j["name"] as String?,
    image: j["image"] as String?,
    role: roleFromString(j["role"] as String? ?? "SISWA"),
  );

  Map<String, dynamic> toJson() => {
    "id": id, "email": email, "name": name, "image": image, "role": roleToString(role),
  };
}
