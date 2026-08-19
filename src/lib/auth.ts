import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"
import { trackLogin } from "@/lib/agents/learning-analytics"

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      id: "credentials",
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        role: { label: "Role", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const email = credentials.email as string
        const password = credentials.password as string
        const role = credentials.role as string

        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, image: true, role: true, password: true },
        })

        if (!user || !user.password) return null
        if (user.role !== role) return null

        const isValid = await bcrypt.compare(password, user.password)
        if (!isValid) return null

        return { id: user.id, email: user.email, name: user.name, image: user.image, role: user.role }
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role
      }
      return session
    },
    async signIn({ user, account }) {
      if (user?.id) {
        const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true, role: true } })
        if (dbUser?.role === "SISWA") {
          const siswa = await prisma.siswa.findUnique({ where: { userId: dbUser.id }, select: { id: true } })
          if (siswa) trackLogin(siswa.id).catch(() => {})
        }
      }
      return true
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
})
