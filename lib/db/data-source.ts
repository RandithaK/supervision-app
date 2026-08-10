import "reflect-metadata";
import { DataSource, Repository } from "typeorm";
import { User } from "./entities/User";
import path from "path";

const dbPath = path.resolve(process.cwd(), "sqlite.db");

declare global {
  // eslint-disable-next-line no-var
  var __typeorm_datasource__: DataSource | undefined;
}

export async function getDataSource(): Promise<DataSource> {
  if (!globalThis.__typeorm_datasource__) {
    const dataSource = new DataSource({
      type: "better-sqlite3",
      database: dbPath,
      synchronize: true,
      logging: false,
      entities: [User],
    });
    globalThis.__typeorm_datasource__ = await dataSource.initialize();
  } else if (!globalThis.__typeorm_datasource__.isInitialized) {
    await globalThis.__typeorm_datasource__.initialize();
  }

  return globalThis.__typeorm_datasource__;
}

export async function getUserRepository(): Promise<Repository<User>> {
  const dataSource = await getDataSource();
  
  // Find metadata by name or target
  const userMetadata = dataSource.entityMetadatas.find(
    (m) => m.name === "User" || m.tableName === "users" || m.target === User
  );

  if (!userMetadata) {
    console.error("Available entity metadatas:", dataSource.entityMetadatas.map(m => m.name));
    throw new Error(`User entity metadata not found. Available entities: ${dataSource.entityMetadatas.map(m => m.name).join(", ")}`);
  }

  return dataSource.getRepository<User>(userMetadata.target);
}
