// packages/db/src/errors/index.ts
export class DatabaseError extends Error {
  public originalError?: any;
  public statusCode: number;

  constructor(message: string, originalError?: any) {
    super(message);
    this.name = "DatabaseError";
    this.originalError = originalError;
    this.statusCode = 500;
  }
}