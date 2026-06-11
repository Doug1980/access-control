export interface AppUser {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  createdAt: string;
  updatedAt: string;
}

export type CreateUserInput = Pick<AppUser, "name" | "email" | "role">;
export type UpdateUserInput = Partial<CreateUserInput>; 