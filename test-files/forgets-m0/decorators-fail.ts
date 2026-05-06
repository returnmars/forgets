function Controller(_path: string) {
  return function decorate(_target: unknown) {};
}

@Controller("/users")
class UsersController {}

console.log(UsersController);
