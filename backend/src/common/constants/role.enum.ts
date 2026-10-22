/** 6 actor trong SRS mục 1.3.1. Guest là người chưa đăng nhập nên không có role trong DB. */
export enum Role {
  Customer = 'CUSTOMER',
  Receptionist = 'RECEPTIONIST',
  ServiceStaff = 'SERVICE_STAFF',
  OperationsStaff = 'OPERATIONS_STAFF',
  Manager = 'MANAGER',
}
