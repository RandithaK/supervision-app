import "reflect-metadata";
import { DataSource, Repository } from "typeorm";
import { User } from "./entities/User";
import { SupervisionApplication } from "./entities/SupervisionApplication";
import { SupervisionAssignment } from "./entities/SupervisionAssignment";
import { OtpVerification } from "./entities/OtpVerification";
import { AppSetting } from "./entities/AppSetting";
import path from "path";

const dbPath = path.resolve(process.cwd(), "sqlite.db");

declare global {
  // eslint-disable-next-line no-var
  var __typeorm_datasource__: DataSource | undefined;
}

export async function getDataSource(): Promise<DataSource> {
  const entities = [User, SupervisionApplication, SupervisionAssignment, OtpVerification, AppSetting];

  // Self-healing check for stale cached DataSource in dev mode HMR
  if (globalThis.__typeorm_datasource__) {
    const initializedNames = globalThis.__typeorm_datasource__.entityMetadatas.map((m) => m.name);
    const hasAllEntities = ["User", "SupervisionApplication", "SupervisionAssignment", "OtpVerification", "AppSetting"].every((name) =>
      initializedNames.includes(name)
    );

    if (!hasAllEntities && globalThis.__typeorm_datasource__.isInitialized) {
      await globalThis.__typeorm_datasource__.destroy();
      globalThis.__typeorm_datasource__ = undefined;
    }
  }

  if (!globalThis.__typeorm_datasource__) {
    const dataSource = new DataSource({
      type: "better-sqlite3",
      database: dbPath,
      synchronize: true,
      logging: false,
      entities,
    });
    globalThis.__typeorm_datasource__ = await dataSource.initialize();
  } else if (!globalThis.__typeorm_datasource__.isInitialized) {
    await globalThis.__typeorm_datasource__.initialize();
  }

  return globalThis.__typeorm_datasource__;
}

export async function getUserRepository(): Promise<Repository<User>> {
  const dataSource = await getDataSource();
  const meta = dataSource.entityMetadatas.find(
    (m) => m.name === "User" || m.tableName === "users"
  );
  return dataSource.getRepository<User>(meta ? meta.target : User);
}

export async function getApplicationRepository(): Promise<Repository<SupervisionApplication>> {
  const dataSource = await getDataSource();
  const meta = dataSource.entityMetadatas.find(
    (m) => m.name === "SupervisionApplication" || m.tableName === "supervision_applications"
  );
  return dataSource.getRepository<SupervisionApplication>(meta ? meta.target : SupervisionApplication);
}

export async function getAssignmentRepository(): Promise<Repository<SupervisionAssignment>> {
  const dataSource = await getDataSource();
  const meta = dataSource.entityMetadatas.find(
    (m) => m.name === "SupervisionAssignment" || m.tableName === "supervision_assignments"
  );
  return dataSource.getRepository<SupervisionAssignment>(meta ? meta.target : SupervisionAssignment);
}

export async function getOtpRepository(): Promise<Repository<OtpVerification>> {
  const dataSource = await getDataSource();
  const meta = dataSource.entityMetadatas.find(
    (m) => m.name === "OtpVerification" || m.tableName === "otp_verifications"
  );
  return dataSource.getRepository<OtpVerification>(meta ? meta.target : OtpVerification);
}

export async function getSettingRepository(): Promise<Repository<AppSetting>> {
  const dataSource = await getDataSource();
  const meta = dataSource.entityMetadatas.find(
    (m) => m.name === "AppSetting" || m.tableName === "app_settings"
  );
  return dataSource.getRepository<AppSetting>(meta ? meta.target : AppSetting);
}
