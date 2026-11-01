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
  final String? jabatan;
  final String? kelas;
  final String? guruId;
  final String? siswaId;

  User({
    required this.id, required this.email, this.name, this.image, required this.role,
    this.jabatan, this.kelas, this.guruId, this.siswaId,
  });

  factory User.fromJson(Map<String, dynamic> j) {
    final kelasRaw = j["kelas"];
    return User(
      id: j["id"] as String,
      email: j["email"] as String,
      name: j["name"] as String?,
      image: j["image"] as String?,
      role: roleFromString(j["role"] as String? ?? "SISWA"),
      jabatan: j["jabatan"] as String?,
      kelas: kelasRaw is Map ? kelasRaw["nama"] as String? : kelasRaw as String?,
      guruId: j["guruId"] as String?,
      siswaId: j["siswaId"] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    "id": id, "email": email, "name": name, "image": image, "role": roleToString(role),
    if (jabatan != null) "jabatan": jabatan,
    if (kelas != null) "kelas": kelas,
    if (guruId != null) "guruId": guruId,
    if (siswaId != null) "siswaId": siswaId,
  };
}
