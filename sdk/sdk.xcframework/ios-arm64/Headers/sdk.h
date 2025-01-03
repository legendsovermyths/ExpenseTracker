#include <cstdarg>
#include <cstdint>
#include <cstdlib>
#include <ostream>
#include <new>

extern "C" {

char *invoke_request(const char *input);

void free_response(char *ptr);

const char *hello_world();

}  // extern "C"
