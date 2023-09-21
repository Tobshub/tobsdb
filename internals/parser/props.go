package parser

import (
	"strconv"
	"strings"

	TDBTypes "github.com/tobshub/tobsdb/internals/types"
)

func ParseRelationProp(relation string) (string, string) {
	parsed_rel := strings.Split(relation, ".")
	return parsed_rel[0], parsed_rel[1]
}

func ParseVectorProp(value string) (TDBTypes.FieldType, int) {
	parsed_val := strings.Split(value, ",")
	vector_level, err := strconv.ParseInt(strings.TrimSpace(parsed_val[1]), 10, 0)
	if err != nil || vector_level < 1 {
		vector_level = 1
	}
	return TDBTypes.FieldType(parsed_val[0]), int(vector_level)
}
