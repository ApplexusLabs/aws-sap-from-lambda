method IF_REST_APPLICATION~GET_ROOT_HANDLER.
  DATA lo_handler TYPE REF TO cl_rest_router.
  CREATE OBJECT lo_handler.
  lo_handler->attach( iv_template = '/stock'  iv_handler_class = 'ZCL_AWS1_RES_STOCK' ).
  ro_root_handler = lo_handler.
endmethod.