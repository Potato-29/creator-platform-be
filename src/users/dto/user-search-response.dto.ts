export class UserSearchResponseDto {
    id: string;
    userName: string;
    firstName: string;
    lastName: string;
  
    constructor(partial: Partial<UserSearchResponseDto>) {
      Object.assign(this, partial);
    }
}